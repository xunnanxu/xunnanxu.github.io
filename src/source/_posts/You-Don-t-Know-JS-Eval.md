---
title: You Don't Know JS - Eval
date: 2016-10-01 16:03:31
categories:
- You Don't Know JS
tags:
- javascript
---

<!-- toc -->

Recently I've been writing quite a bit of front-end stuff and seen quite a few tricks from other people's libraries. It turns out JavaScript is a pretty ~~wonky and fked up~~ interesting language, which tempts me to write a series about it and this is the first one. This is by no means supposed to show how to write JS but just to show some "wacky" stuff.

## Have you seen eval() written like this?

    (0, eval)('something');

{% rage_face 'Are you fucking kidding me' style:width:200px %}

## Regular eval

Eval basically allows you to execute any script within the given context.

For example:

{% codeblock lang:js %}
eval('console.log("123");');            // prints out 123

(function A() {
    this.a = 1;

    eval('console.log(this.a);');            // 1
})();

{% endcodeblock %}

So far everything is normal: eval runs inside the current scope. `this` is pointed to the instance of A.

## Global eval

Things get interesting when you do this:

{% codeblock lang:js %}
var someVar = 'outer';

(function A() {
    this.someVar = 'inner';

    eval('console.log(someVar);');       // you may want 'outer' but this says 'inner'
})();

{% endcodeblock %}

Well in this scenario eval cannot get the value of someVar in the global scope.

However ECMA5 says, if you change `eval()` call to indirect, in other words, if you use it as a value rather than a function reference, then it will evaluate the input in the global scope.

So this would work:

{% codeblock lang:js %}
var someVar = 'outer';

(function A() {
    var geval = eval;
    this.someVar = 'inner';

    geval('console.log(someVar);');       // 'outer'
})();

{% endcodeblock %}

Although `geval` and `eval` call the exact same function, `geval` is a value and thus it becomes an indirect call according to ECMA5.

## Back to the original topic

So what the hell is `(0, eval)` then? Well a comma separated expression list evaluates to the last value, so it essentially is a shortcut to

    var geval = eval;
    geval(...);

0 is only a puppet here. It could be any value.

{% rage_face 'So much win' style:width:200px %}