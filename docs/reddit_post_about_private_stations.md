source: [](https://www.reddit.com/r/Eve/comments/8hujh2/market_data_and_esi_a_short_story/)

# Market data and ESI - a short story

As I'm getting the same question daily - why is Evernus fetching market data so slow sometimes (even up to 20min) - I decided to post an explanation here for all to read.

The issue lies with how market data import is implemented in ESI. You only can get whole market data without citadels or specific to given citadel. Unfortunately, there's no way to know from which citadels given character can pull the data. What's worse - there isn't even a way get the citadel list. That's why 3rd party apps have to somehow get the list first, then make a request for each citadel. And that leads to another problem - error rate limiting. Some time ago, the ESI team decided to introduce rate limiting for apps which cause server errors (due to invalid requests, etc.). While this is normally a good decision to make, it had the unfortunate consequence of effectively killing any efficient market import. Why? Because each request for market data from a citadel to which the character has no access results in an error. That means if you don't know upfront which citadels to ask for, you will spend unholy amount of time waiting for rate-limited server replies. Only then you know what to ask for next time.

...only that it's not totally true still. Citadels are in constant flux - new are deployed, existing get destroyed. That means, in time, the list of "good" citadels to ask for becomes obsolete and you need to refresh it again => spend another half an hour waiting for data. Unfortunately, there is no workaround. My request for an endpoint which will return the same order list as the one you see in Eve, was shot down because of technical reasons. Unless we get an endpoint giving us available citadel list, for which I've asked a long time ago and was given the answer it won't happen in the foreseeable future, there is nothing we can do about it.

To make matters worse, there's another problem looming at the horizon - the only way to get a list of citadels in Eve is to use a 3rd party service, Structure Hunters. Some time ago it became offline for a short period, which resulted in a realization - with them gone, **there will be no way to get reliable market data**. None, zero, nada. Unless a character has a bookmark in every citadel there is, which is, putting it mildly, not very practical.

And there you have it - the reason importing market data from Eve is so slow. On a personal note, I've been maintaining Evernus for ~4y now, and from a fun hobby project, it's starting to become a constant battle to get things working in a usable way. I'm slowly getting tired, and unless some brave soul decides to help, I can already see the end of the project approaching. Whatever happens, it's been a nice journey creating, what I dare to say, is one of the most complex Eve applications out there. Thanks for all your support all those years, and I hope I cleared few things up in this post.
 
Upvote
61

Downvote
 
39
Go to comments


Share
 
