---
title: 'Implementing Regex from Scratch: 1 - The Basics of Regex and Finite Automata'
date: 2018-05-12 17:32:25
tags:
- regex
- parsing
- lexing
- nfa
- dfa
- algorithm
- python
---

# Intro

Implementing a regular expression engine is a fun topic and it can be quite complex.
Unfortunately most of the tutorials are either too complex to follow,
or impractical, meaning you can't just read it and build one yourself.

We are going to fix it in this series.
Our goal here is not to build a fully-fledged engine
that can performantly handle all cases since that's already provided by popular languages,
but rather we will try to build a usable one from ground up
that can handle a clearly defined set of features.
Through this we can get a better understanding
of how it works and where it can be optimized.

# Index

There's no concrete plan as of now but I'll update the list as we move on.

The topics we are going to cover includes basics, lexing, parsing, processing and basic optimization.

# Prerequisites

As the title says, readers aren't supposed to be equipped with much knowledge
about this before reading this as they will be explained and discussed in this post.

However since we are building an engine from scratch, this post assumes you:

- Know what a regex is and how to read/write regex
- Have heard about finite automata/NFA/DFA
- Know what lexing and parsing mean
- Basic knowledge about algorithm - e.g. BFS and DFS

If you don't, you might want to check Wikipedia first to
familarize yourself with those topics.
It wouldn't hurt if you don't have deep understanding of those
but basic knowledge would help.

# Goal

Our goal is to implement a regex processor that understands

- Basic literal and escaping - `abc123\?`
- Alternation - `ab|cd`
- Quantification - `a?`, `a+`, `a*`, `{1,2}`, `{2}`
- Grouping - `(ab)+`, `a(b|c)d`
- Wildcard - `.`
- Anchors - `^`, `$`
- Extended characters - `\d`, `\w`, `\s`
- Character classes - `[a-z]`, `[^a]`

So it should understand that `^a(b+|[c-z]?)+\?d.+$` would match `abbcw?ds`
but not `bbcw?ds` or `abbcds`.

Notice that there is a lot of features missing here:
we don't support non-capturing group `(?:)`,
capturing group replacement `$1`,
non-greedy matching like `.*?`,
or any other basic/advanced regex syntax.
It's possible to cover those topics but that might make the post too
complex to follow for first-time readers. So we will keep the scope minimal
if possible and only include topics if time permits.

# The Basics

Regular expression is a typical context-free language,
which means there a finite number of predefined replacement rules
(or more formally, production rules) that can be applied regardless of context,
yielding a stable "converged" state from the original one.

While one can possibly search in text through basic regex using DFS and backtracking,
the actual implementation can be very complicated once more features are added in.
So in practice, they are typically implemented through state machines, or finite automata.

For example this would be the finite automata that checks if a string is "ab".
{% asset_img sm.png %}
And this is how it is evaluated in practice.

|        Current State            |            Input Char                  |
|:-------------------------------:|:--------------------------------------:|
|          `<Start>`              |                `a`                     |
|            `s1`                 |                `b`                     |
|          `<End>`                |              `<EOS>`                   |

If we reach state `<End>` then the input string is a match, otherwise it's not.

This one is a deterministic finite automata, or DFA.
The nice thing about DFA is that each state transition is determined based on input
so there's no need to backtrack.
This implies you could implement that in code with nothing but
a two dimensional array with on representing the possible states (nodes)
and the other representing transitions (edges).

Here's how that one will be represented (row -> state, column -> input).
The cell value represents the next state (row id) with -1 being invalid.

|     |  a  |  b  |
|:---:|:---:|:---:|
|  S  |  1  | -1  |
|  1  | -1  |  2  |
|  E  | -1  | -1  |

```python
trans_mat = [
    [1, -1],
    [-1, 2],
    [-1, -1]
]
```

Then the actual implementation is just a for loop and checks if we are in state E.

# Using NFA to Represent Advanced Regex Syntax

So if DFA is easy on the implementation side, can we actually implement regex in that?

The answer is YES. However, it's not intuitive to write down the DFA directly.
So let's first take an intermediate step.

Say we need to implement `a|bc`. One intuitive thought is to write down a graph like this:
{% asset_img example2.png %}
Notice that we actually introduced epsilon (ε) transition here.
An epsilon transition is one that allows for spontanous transition (without consuming input).
You might wonder how is that different from just connecting the nodes directly,
and you are totally right - they are effectively the same. That is called compression, but in
this post we are going to focus only on the basics and we'll talk about optimization later.

However, this branching causes that this is no longer a DFA but rather a non-deterministic
finite automata, or NFA, because the transition from start to the next state is no longer
uniquely determined. This would make the implementation trickier. There are basically two
ways to simulate an NFA: DFS with backtracking, or Thompson's algorithm, which is somewhat
like a BFS.

There's proof that every NFA has a corresponding DFA. The conversion can be done through
algorithm called "powerset construction", which we will talk about in later optimization topic.

Even though NFA is not as performant as DFA in terms of implementation, it greatly reduces
brainwork to abstract the regex. Below we can see how some of the common syntaxes can be
represented through NFA with the help of ε transition and additional pseudo states.
