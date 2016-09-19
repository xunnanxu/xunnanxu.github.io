---
title: Why you should ditch Browserify and CommonJS in the http/2 world
date: 2016-09-18 10:15:36
categories:
- Frontend
tags:
- http2
- browserify
- javascript
- dependency-management
- modular-design
- es6
---

{% alert info no-icon %}
Stop bundling in the http/2 world since it does it for you.
{% endalert %}

<!-- toc -->

# Modularization is a great idea

Back in the old days where there were no concept regarding frontend package management, we would lay out all the scripts in order in the html file, and hope for the best that they would somehow work together if order were right. This surely doesn't work well with huge projects, but luckily back then JavaScripts weren't so shiny anyways - UIs weren't so cool and logic was much simpler. However, things do evolve. People soon noticed that this approach wouldn't scale - cooperation across multiple teams becomes super tricky, if not impossible, and it doesn't play well with DRY either.

Then people came up with a great idea of modularizing JS code (probably back in 2003?) the same way you would do for your beloved Java/C++ code libraries. And then there came the CommonJS definition concept by Kevin Dangoor back in 2009. Many people got to know this idea thanks to Node.js, and it works quite well, especially for server side code. Now you can easily use npm and build both the frontend and backend using the same tool very quickly, thanks to the JS community. Since people have the same interface for code modularization, team cooperation becomes much easier and projects gain benefit from much better encapsulation.

<!-- more -->

# And browserify was a great tool

Browerify is a bundling tool based on CommonJS definition by providing polyfill for `require` and `define` calls in browser. Back in the days when AMD wasn't ready, it gave people an easy way of defining your modules the same way as for other node modules and serving everything together as one giant bundle. The idea is based on the fact that browsers have concurrent http request limit, let alone now full-site https becomes popular and SSL handshaking is quite expensive. So by bundling, you cut the number of required requests and hence you get faster page loading.

# However, there are a few small problems...

Unlike AMD, CommonJS is synchronous and you can tell from their API design:

{% codeblock AMD lang:js %}
define(['foo', 'bar'], function (foo, bar) {
    // code begins
});
{% endcodeblock %}

{% codeblock CommonJS lang:js %}
var foo = require('foo');
var bar = require('bar');

// code begins
{% endcodeblock %}

It's easy to load AMD modules asynchronously because the actual code lives in a callback so your loader can play scatter-n-gather. For CommonJS, however, each require call would have to wait until the previous one comes back, which means the loader cannot utilize Ajax and spread the load to multiple http requests in order to speed up the loading process. The solution for browserify is to bundle everything together and hence it can just grab that reference for you in a map. However, if your code library is huge, then it means your initial page load time and above-the-fold time (time between user hits enter and the content in the current browser window stops changing) will be negatively impacted. Moreover, on demand module loading becomes impossible here while in AMD, it's pretty simple.

Another problem with browserify, which is the main reason why I don't like it, is that bundling becomes mandatory. This makes local dev environment setup and testing tricky and surprise-prone. Using browserify means if my app requires ABC in general, I still need to bundle everything together while I just want to test C. To me that's just ridiculous.

# And http/2 increases the gap

Http/2 introduces multiplexing which makes CommonJS approach even more crippled. Multiplexing means now you can use one TCP connection to transfer different content from different sources (URLs) on a single host, which makes asynchronous module loading greater. But if you bundle everything together, sorry you are just ignoring all those benefits.

A lot of CDNs support http/2 now, including Akamai, Cloudflare and Cloudfront, you name it. Here's a demo from cloudflare:

{% asset_img comparison.gif %}

(Tested in Chrome 53.0)

# So what to use instead?

ECMA 6 is really the way to go. It consolidates the nice API design from CommonJS and the asynchronous and on-demand module loading feature from AMD. Currently, most browsers don't support it yet (as of Sep 2016). Surprisingly Microsoft leads the way this time by [allowing you to turn on this experimental feature](https://blogs.windows.com/msedgedev/2016/05/17/es6-modules-and-beyond). Regardless of that, Babel can help you turn es6 code to es5, and System.js can fill the gap as the module loader.

JSPM, Babel and System.js is a good combination for the time being. Everything just works seamlessly across different scenarios - you don't need to bundle anything in dev environment while getting all the benefits in production with the same set of configuration. You have the freedom - choose to bundle your scripts for best performance for legacy browser support, or on demand, no bundling for best performance under http/2. The actual workflow configuration is out of the scope of this post. I'll write a post later to discuss this in details, including comparison with the popular bundler - webpack.

However, if you can't switch to that for some reason, you can still keep using AMD. The major problems with AMD are:

1. tedious API design (I don't see how this can be changed without a transpiler due to native JS limit)
2. not friendly to IDE due to separation of module naming and configuration (and webpack suffers from similar issues)

Http/2 makes a lot of old "golden rules" no longer correct. Spriting for images and bundling for scripts used to be so true that some people just blindly follow them. However, the world keeps involving so time to keep our eyes open.