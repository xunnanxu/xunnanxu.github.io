---
title: You Don't Know JS - Equal or Not Equal
date: 2016-10-03 19:40:48
categories:
- You Don't Know JS
tags:
- javascript
- frontend
---

<!-- toc -->

## == and ===

Likely you know the difference between `==` and `===`: basically, `===` means strict equality where no implicit conversion is allowed whereas `==` is loose equality.

{% codeblock lang:js %}

'a' === 'a'     // true
0 == false      // true

{% endcodeblock %}

## Dig deeper

OK but this is too boring since we all know that.

How about this:

{% codeblock lang:js %}

String('a') === 'a'
new String('a') === 'a'

{% endcodeblock %}

Well the answers are `true` and `false` because `String()` returns a primitive string while `new String()` returns a string object. Surely `new String('a') == 'a'` yields `true`. No surprise.

### What about arrays?

    [] === []

Well this returns `false` because for non-primitive objects, they are compared by reference. This always returns `false` because they are different in terms of memory location.

However surprisingly you can compare arrays like this:

    [1, 2, 3] < [2, 3]      // true
    [2, 1, 3] > [1, 2, 3]   // true

{% rage_face 'Blonde hmmm' style:width:125px %}

(Wait a sec. I think I have an idea.)

How about this:

    function arrEquals(arr1, arr2) {
        return !(arr1 < arr2) && !(arr2 < arr1);
    }

{% rage_face 'Fuck yeah smile' style:width:125px %}

Well this is wrong because arrays will be flattened when compared, like this

    [[1, 2], 1] < [1, 2, 3]     // true

### What about objects

What's the result of this expression?

    {} === {}

Well it's neither `true` nor `false` but you get `SyntaxError` because in this case `{}` is not an object literal but a code block and thus it cannot be followed with `=`. Anyway we are drifting away from the original topic...

## Implicit conversions

Well that's just warm-up. Let's see something serious.

If you read something about "best practices", you would probably be told not to use `==` because of the evil conversion. However chances are you've used it here and there and most likely that's also part of the "best practices".

For example:

    var foo = bar();
    if (foo) {
        doSomething();
    }

This works because in JavaScript, only 6 object/literals are evaluated to `false`. They are `0`, `''`, `NaN`, `undefined`, `null` and of course `false`. Rest of the world evaluates to `true`, including `{}` and `[]`.

Hmm here's something wacky:

{% codeblock lang:js %}

var a = {
    valueOf: function () {
        return -1;
    }
};

if (!(1 + a)) {
    alert('boom');
}

{% endcodeblock %}

Your code does go boom because `1 + a` gets implicitly converted to `1 + a.valueOf()` and hence yields `0`.

The actual behavior is documented in ECMA standard - http://www.ecma-international.org/ecma-262/6.0/#sec-abstract-equality-comparison

In most cases, implicit conversion would cause `valueOf()` to be called or falls back to `toString()` if not defined.

For example:

{% codeblock lang:js %}

var foo = {
    valueOf: function () {
        return 'value';
    },
    toString: function () {
        return 'toString';
    }
};

'foo' + foo             // foovalue

{% endcodeblock %}

This is because according to standard, when `toPrimitive` is invoked for implicit conversion with no *hint* provided (e.g. in the case of concatenation, or when `==` is used between different types), it by default prefers `valueOf`. There are a few exceptions though, including but not limited to `Array.prototype.join` and `alert`. They would call `toPrimitive` with `string` as the hint so `toString()` will be favored.

## Conclusion

In general, you probably want to avoid using `==` and use `===` most of the time if not always to avoid worrying about wonky implicit conversion magic.

However, you can't be wary enough. For example:

    isNaN('1') === true

You might think that `'1'` is a string and hence this should be `false` but unfortunately `isNaN` always calls `toNumber` internally ([spec](http://www.ecma-international.org/ecma-262/6.0/#sec-tonumber)) and hence this is `true`.

{% rage_face 'Computer stare' style:width:200px %}
