const notice = msg => new Notice(msg, 5000);
const log = msg => console.log(msg);
const API_KEY_OPTION = "Hardcover API Key";
const API_URL = "https://api.hardcover.app/v1/graphql";
const HARDCOVER_BASE_URL = "https://hardcover.app/books/";

module.exports = {
    entry: start,
    settings: {
        name: "Hardcover API Script",
        author: "https://github.com/harshallmall",
        options: {
            [API_KEY_OPTION]: {
                type: "text",
                defaultValue: "",
                placeholder: "Your Hardcover API Key",
            },
        }
    }
}

let QuickAdd;
let Settings;

async function start(params, settings) {
    QuickAdd = params;
    Settings = settings;
    const query = await QuickAdd.quickAddApi.inputPrompt(
        "Search by title, author, or paste a Hardcover book ID (number):"
    );
    if (!query) {
        notice("No query was entered.");
        throw new Error("No query was entered.");
    }
    let selectedBook;
    if (isHardcoverId(query)) {
        selectedBook = await getBookById(Number(query));
    } else {
        const results = await searchBooks(query);
        const choice = await QuickAdd.quickAddApi.suggester(
            results.map(formatBookForSuggestion),
            results
        );
        if (!choice) {
            notice("Nothing selected.");
            throw new Error("Nothing selected.");
        }
        selectedBook = choice;
    }
    if (!selectedBook) {
        notice("Could not retrieve book data.");
        throw new Error("Could not retrieve book data.");
    }
    const authors = (selectedBook.contributions || [])
        .map(c => c.author && c.author.name)
        .filter(Boolean);
    const genres = (selectedBook.cached_tags && selectedBook.cached_tags.Genre)
        ? selectedBook.cached_tags.Genre.map(g => g.tag)
        : [];
    const moods = (selectedBook.cached_tags && selectedBook.cached_tags.Mood)
        ? selectedBook.cached_tags.Mood.map(m => m.tag)
        : [];
    const contentWarnings = (selectedBook.cached_tags && selectedBook.cached_tags["Content Warning"])
        ? selectedBook.cached_tags["Content Warning"].map(w => w.tag)
        : [];
    const seriesName = selectedBook.book_series && selectedBook.book_series.length > 0
        ? selectedBook.book_series[0].series && selectedBook.book_series[0].series.name
        : null;
    const seriesPosition = selectedBook.book_series && selectedBook.book_series.length > 0
        ? selectedBook.book_series[0].position
        : null;
    const defaultEdition = selectedBook.default_physical_edition || {};
    const isbn = defaultEdition.isbn_13 || defaultEdition.isbn_10 || "";
    const publisher = (defaultEdition.publisher && defaultEdition.publisher.name) || "";
    const pages = defaultEdition.pages || selectedBook.pages || "";
    const publishedDate = defaultEdition.release_date || selectedBook.release_date || "";
    QuickAdd.variables = {
        ...selectedBook,
        bookId: String(selectedBook.id),
        title: selectedBook.title || "",
        fileName: replaceBadCharactersInString(selectedBook.title || ""),
        hardcoverUrl: HARDCOVER_BASE_URL + (selectedBook.slug || selectedBook.id),
        coverUrl: selectedBook.image && selectedBook.image.url ? selectedBook.image.url : "",
        description: stripHTML(selectedBook.description || ""),
        rating: selectedBook.rating ? String(selectedBook.rating.toFixed(1)) : "",
        ratingsCount: selectedBook.ratings_count ? String(selectedBook.ratings_count) : "",
        releaseDate: formatDate(publishedDate),
        releaseYear: publishedDate ? new Date(publishedDate).getFullYear().toString() : "",
        pages: pages ? String(pages) : "",
        isbn,
        publisher,
        authorLinks: linkifyList(authors),
        genreLinks: linkifyList(genres),
        moodLinks: linkifyList(moods),
        contentWarningLinks: linkifyList(contentWarnings),
        authorsStr: authors.join(", "),
        genresStr: genres.join(", "),
        series: seriesName || "",
        seriesPosition: seriesPosition ? String(seriesPosition) : "",
        seriesLink: seriesName ? `[[${seriesName}]]` : "",
    };
}

function isHardcoverId(str) {
    return /^\d+$/.test(str.trim());
}

async function searchBooks(query) {
    const gql = `
        query SearchBooks($query: String!) {
            search(query: $query, query_type: "Book", per_page: 10) {
                results
            }
        }
    `;
    const data = await graphqlRequest(gql, { query });
    const raw = data && data.search && data.search.results;
    if (!raw) {
        notice("No results found.");
        throw new Error("No results found.");
    }
    const hits = raw.hits || [];
    if (!hits.length) {
        notice("No results found.");
        throw new Error("No results found.");
    }
    const bookIds = hits.map(h => h.document && h.document.id).filter(Boolean);
    if (!bookIds.length) {
        notice("No results found.");
        throw new Error("No results found.");
    }
    return await getBooksByIds(bookIds.slice(0, 10));
}

async function getBooksByIds(ids) {
    const gql = `
        query GetBooks($ids: [Int!]!) {
            books(where: { id: { _in: $ids } }) {
                ${bookFields()}
            }
        }
    `;
    const data = await graphqlRequest(gql, { ids });
    return (data && data.books) || [];
}

async function getBookById(id) {
    const gql = `
        query GetBook($id: Int!) {
            books(where: { id: { _eq: $id } }) {
                ${bookFields()}
            }
        }
    `;
    const data = await graphqlRequest(gql, { id });
    const books = (data && data.books) || [];
    if (!books.length) {
        notice("Book not found.");
        throw new Error("Book not found.");
    }
    return books[0];
}

function bookFields() {
    return `
        id
        title
        slug
        description
        release_date
        pages
        rating
        ratings_count
        image { url }
        contributions {
            author { name slug }
        }
        book_series {
            position
            series { name slug }
        }
        default_physical_edition {
            isbn_13
            isbn_10
            pages
            release_date
            publisher { name }
        }
        cached_tags
    `;
}

async function graphqlRequest(query, variables) {
    const apiKey = Settings && Settings[API_KEY_OPTION];
    if (!apiKey || String(apiKey).trim() === "") {
        notice("Please set your Hardcover API key in the script settings.");
        throw new Error("Missing Hardcover API key.");
    }
    // Accept either a raw token, or the one that the user added with "Bearer" header.
    const rawToken = String(apiKey).trim().replace(/^Bearer\s+/i, "");
    const authHeader = `Bearer ${rawToken}`;
    const body = JSON.stringify({ query, variables });
    const res = await request({
        url: API_URL,
        method: "POST",
        cache: "no-cache",
        headers: {
            "content-type": "application/json",
            "authorization": authHeader,
            "user-agent": "ObsidianQuickAdd-HardcoverScript/1.0",
        },
        body,
    });
    const parsed = JSON.parse(res);
    if (parsed.errors && parsed.errors.length) {
        const msg = parsed.errors.map(e => e.message).join("; ");
        notice(`Hardcover API error: ${msg}`);
        throw new Error(`Hardcover API error: ${msg}`);
    }
    return parsed.data;
}

function formatBookForSuggestion(book) {
    const year = book.release_date ? new Date(book.release_date).getFullYear() : "?";
    const author = book.contributions && book.contributions[0] && book.contributions[0].author
        ? book.contributions[0].author.name
        : "Unknown author";
    return `${book.title} — ${author} (${year})`;
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function linkifyList(list) {
    if (!Array.isArray(list) || list.length === 0) return "";
    return list.map(item => `\n  - "[[${item.trim()}]]"`).join("");
}

function replaceBadCharactersInString(input) {
    if (!input) return "";
    return input.replace(/[\\,#%&\{\}\/*<>$'\":@]/g, "").trim();
}

function stripHTML(html) {
    if (!html) return "";
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .trim();
}