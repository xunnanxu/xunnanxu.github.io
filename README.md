## Env Setup

### Node
```shell
$ brew install nodeenv
$ nodeenv --prebuilt .nodeenv
$ source .nodeenv/bin/activate
```

### Dependencies

```shell
$ cd src
$ npm install
```

### CLI

```shell
$ npm install hexo-cli@latest
$ npx hexo version
$ npx hexo server
```

### Additional Changes

**header.ejs**
```ejs

<script type="module">import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';</script>
```
