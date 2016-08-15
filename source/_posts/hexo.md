---
title: Get Started with Hexo Blogging System
date: 2016-08-14 14:32:53
categories:
- Hexo
tags:
- blog
- hexo
---

# You should read this if

- You want to set up a personal blog
- You know what [Markdown](https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet) is
- You don't want to set up a heavy Wordpress environment
- You don't want to set up any database just for the blog
- You either don't have a VPS or want to host blog content in some easy-to-reach place.
- You still want a template/theme system.

# Solution

Github Pages + Hexo (what this site uses)

# What is Hexo

"[Hexo](https://hexo.io/docs/index.html) is a fast, simple and powerful blog framework. You write posts in Markdown (or other languages) and Hexo generates static files with a beautiful theme in seconds."

In other words, Hexo is a **static** blogging system. This means there is no need for database, node/php code to maintain like Wordpress or other dynamic blogging systems require. Awesome.

# How on earth do things work

- You write posts using Markdown language and preview them locally
- Hexo generates the static htmls locally
- You commit all static assets to Github
- All content will be public via Github IO
    - When you hit path that ends with /, Github will attempt to read index.html under that directory, i.e. for /foo/, the corresponding file is /foo/index.html
    - For URLs don't end with / (except root), Github will try to read the corresponding file, i.e. for /foo, if file foo doesn't exist, 404 will be returned.
    - Generally, Hexo's path layout should be fine but if you use certain themes (like the default landscape), you might need to fix the URLs manually if they don't end with / while they should.

# What this solution cannot do

You can think of Hexo as a lightweight templating system so most dynamic features that Wordpress offer don't exist, including searching (provided by simple google search instead), comment system (you can use Disqus instead), dynamic widgets like top posts, permalink backend forwarding and so on.

However, do you really need these?

# Get started

If you've read this far, chances are you want to give it a try. Here are the steps:

1. Install node (required by Hexo): https://nodejs.org/en/download/

2. Install Hexo


    npm install -g hexo-cli
    
    // this downloads the starter pack and sets up node modules under the directory <name> for you so it may take a while
    hexo init <name>

3. Open <name>/_config.yml and there may be a few things you want to set such as the name and author. The most important things are the `url` and `root`. The details can be found [here](https://hexo.io/docs/configuration.html)

4. By default Hexo will generate the Hello world post for you. You can preview it by starting the local server:


     hexo server

5. Generate actual assets:


     hexo generate

6. Set up Github page repo: https://pages.github.com/

Depending on if you have a VPS, things maybe a bit different. Follow 7a if you do and 7b if not. The major difference is the directory structure in the repo.

7a-1. Hexo by default publishes all static assets to `public`. However, Github by default expects stuff to be under root. That means, with this setup, the repo needs to be rooted at `public`:

    cd public
    git init
    git remote add origin <repo url>
    git pull

7a-2. Commit all assets:

    git add --all
    git commit -m "..."
    git push

7a-3. If you have a custom domain, set CNAME pointed to your.github.io and remember to disable https enforcement in Github (since SSL will verify host name). Also don't forget to set the custom url in Github.

---


7b-1. If you have a VPS then you can commit all the files and just use github as the storage area since you can do backend url forwarding.

    // nginx config:
    server {
        listen       80;
        server_name  xcorpion.tech;
    
        location / {
            proxy_set_header Host xcorpion.tech;
            proxy_pass http://your.github.io/public/;
        }
    }

7b-2. If you have a custom domain, set A record pointed to your server IP and similarily, remember to turn off https enforcement. Also don't forget to set the custom url in Github.

# And that's it! Let's start writing!

- In your hexo root directory, start a new post:


    hexo new post

- Preview your post with


    hexo server

- In preview mode, Hexo will watch your files and automatically update the html. However, it **will not** publish any static assets (those eventually shown in your site). So run this to let hexo do it:


    hexo generate

- Then commit the changes to your repo (You can automate this with a shell script.)
