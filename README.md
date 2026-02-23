# Hardcover API #
## Book Script for Obsidian ##
- This script is meant for integration with Obsidian's QuickAdd plugin and more specifically, its Macro scripting ability, in order to retrieve book information and cover images from Hardcover.
- OG and Inspiration:
  - https://github.com/chhoumann/quickadd
  - https://quickadd.obsidian.guide/docs/Examples/Macro_MovieAndSeriesScript
- Using this Script:
  -  It essentially mirrors the setup workflow on the 'Examples' section of the QuickAdd docs.
- Caveat:
  - Hardcover API uses GraphQL.
  - Since Hardcover includes (and expects) `Authorization` and `Content-Type` headers in its API usage, they should actually be in lowercase (*see* Hardcover - Community Examples). Therefore, the script needs to be case-specific when building the headers.
  - Admittedly, I do not have much experience with GraphQL, so on my first iteration, the script did not work. I realized that it was because I was including Bearer in the settings field of QuickAdd (*to be fair*[1^], the examples use it specifically as if the full token requires both 'Bearer' and the API token, so *one does not simply*[2^] copy and paste the entire token into the settings field on QuickAdd, as one would with the Movie and Show script.
  - I was unsure if 'Bearer' should be prepended when building the header, or if it should be stripped if one pasted it in therein, so I just made both options viable.
  - A header for `User Agent` is recommended for use in scripts by Hardcover, so I learned why I needed one, and then added it.
 
- [1^]: Know Your Meme, _One Does Not Simply Walk Into Mordor_. (February 23, 2026), https://knowyourmeme.com/memes/one-does-not-simply-walk-into-mordor.
- [2^]: Jared Keeso, _Letterkenny_(2016).
