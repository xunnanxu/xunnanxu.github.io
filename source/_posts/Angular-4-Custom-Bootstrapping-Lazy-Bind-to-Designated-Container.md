---
title: 'Angular 4+ Custom Bootstrapping: Lazy Bind to Designated Container'
date: 2018-05-14 23:50:39
tags:
---

{% alert info no-icon %}
This works for Angular 4-6 so far.
{% endalert %}

<br>
If you have ever used Angular 1.x, you know there's a manual bootstrapping
option which looks like:
```js
angular.bootstrap(document.querySelector('#myApp'), ['myModule'])`
```
This used to be pretty handy until Angular 2 comes in and changes the life.
For some reason they decide to hide that option and ask people to just use
`bootstrap` in `@NgModule`.

I get that because for general users this is good enough,
especially if you are just building a general SPA.
However if you want to build something advanced like lazy loading,
or conditional rendering, then this seems a bit naive.

This is especially annoying when in React its counterpart is as simple as
```js
ReactDOM.render(     
  <MyApp />,
  document.querySelector('#myApp')
);
```

This alone won't drive people away from Angular but it's just one of the examples
that shows Angular wants to force people into its model rather than thinking about
use cases in the real world.

Alright enough whining and let's get to coding. After all, Angular seems excellent
especially it covers everything from development, testing, and packaging out of the box.
Let's leave whining till next time.

I'll create a simple stackblitz app like this:

<iframe style="border:none" width="100%" height="400px" src="https://stackblitz.com/edit/angular-qrrjaz?embed=1&file=src/app/app.component.ts"></iframe>

It's pretty simple. The module tells Angular to bootstrap `AppComponent`,
which looks for an element with tag `<my-app>`. After that it loads the
`HelloComponent` which renders the `greeting` message from input.
The button in `AppComponent` will switch the message to `it works` once clicked.

But what if we want to lazy load it into a div `#myApp` then?

Looking at the document, it is not mentioned. However, if we carefully read it, we'll
see there's [something that reads](https://angular.io/guide/entry-components#a-bootstrapped-entry-component):

> A component can also be bootstrapped imperatively in the module's ngDoBootstrap() method. The @NgModule.bootstrap property tells the compiler that this is an entry component and it should generate code to bootstrap the application with this component.

And there's another chunk on that page that reads:

> Though the @NgModule decorator has an entryComponents array, most of the time you won't have to explicitly set any entry components because Angular adds components listed in @NgModule.bootstrap and those in route definitions to entry components automatically. Though these two mechanisms account for most entry components, if your app happens to bootstrap or dynamically load a component by type imperatively, you must add it to entryComponents explicitly.

And we are like:

{% rage_face 'Are you fucking kidding me' style:width:200px %}

Wait there's another chunk on the [bootstrapping page](https://angular.io/guide/bootstrapping):

> The application launches by bootstrapping the root AppModule, which is also referred to as an entryComponent. Among other things, the bootstrapping process creates the component(s) listed in the bootstrap array and inserts each one into the browser DOM.

Ok I get that. But still, WTF does that mean?

{% rage_face 'Desk flip' style:width:200px %}

Never mind. I figured out through reading ~~document~~ source code. After all, some say,
documentation is for the weak.

## And here are the steps (finally)

First of all, replace `bootstrap` with `entryComponents` in `@NgModule`.
This will tell Angular not to preemptively initialize everything.
In addition to that, the `entryComponents` param will tell angular to prepare
all `ComponentFactory` instances and load them into app's `ComponentFactoryResolver`.
And if you re-read the document you'll see what it means.

So our example app now looks like this:

```js
@NgModule({
  imports:      [ BrowserModule, FormsModule ],
  declarations: [ AppComponent, HelloComponent ],
  entryComponents: [ AppComponent ]
})
```

Next, override the `ngDoBootstrap()` with an empty body.
This will prevent default bootstrapping action when `bootstrapModule()` is called
in `main.ts` file.

```js
export class AppModule {
  public ngDoBootstrap(appRef: ApplicationRef) {

  } 
}
```

Alright now we go back to the `main.ts` file to perform the core magic.

The source code (thanks to TypeScript) tells us that
`platformBrowserDynamic().bootstrapModule(AppModule)`
returns a `NgModuleRef`.

In `NgModuleRef` we can grab the `injector`. As we all know, angular is all about
dependency injection. So we can call `bootstrap` here then and in newer version of
Angular, that would take an `rootSelectorOrNode`.

Great so let's do:

```js
platformBrowserDynamic().bootstrapModule(AppModule)
  .then((moduleRef: NgModuleRef<AppModule>) => {
    const app: ApplicationRef = moduleRef.injector.get(ApplicationRef);
    app.bootstrap(AppComponent, '#myApp');
  })
```

After this our app would boot, but nothing happens if you click on "Knock knock".

WTF?

In Angular 2+, there's the magic of `ngZone`. You can read more about it in their
[zone.js repo](https://github.com/angular/zone.js/). In short, it provides an
"isolated" execution context in which it hijacks the regular DOM methods to provide
feedback loop for Angular to handle events more performantly. So inside Angular zone,
your click is no longer a plain one but enhanced with magic to tell Angular something
has happened.

So how do we get the `ngZone` then? Remeber we have the omnipotent `injector` so we
can do

```js
.then((moduleRef: NgModuleRef<AppModule>) => {
  const app: ApplicationRef = moduleRef.injector.get(ApplicationRef);
  const ngZone: NgZone = moduleRef.injector.get(NgZone);
  ngZone.run(() => {
    app.bootstrap(AppComponent, '#myApp');
  });
})
```

At the end, here's everything in a nutshell:

<iframe style="border:none" width="100%" height="400px" src="https://stackblitz.com/edit/angular-1cnxy4?embed=1&ctl=1&file=src/app/app.module.ts"></iframe>

Enjoy hacking, until they support this with a one-liner.
