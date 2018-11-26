---
title: Building Linux Workspace on Windows 10 via WSL
date: 2018-05-13 15:35:46
tags:
- linux
- windows
- wsl
---

{% asset_img title.png %}

I was not really a fan of Windows 10,
let alone Microsoft decided to ditch the most important feature I liked in Windows 7 - Aero.
In fact, I'd admit that in most cases I use Windows as an entertainment system
rather than a working platform.

Don't get me wrong, Windows is great, both in terms of the quality of the software
and the design/usability of the system by itself. It's also particularly great of you are
a .NET developer, a webmaster using IIS, or a game developer heavily using DirectX.
However, it's just cumbersome to use it as a daily OSS platform, namely there lacks the
general ecosystem and the tools are just different. Yes you can install node, java, maven,
gradle, and you can probably use powershell to write shell scripts, but at the end of the day,
the overall configuration just feels different and since most people don't use Windows
for work on a day-to-day basis, it just takes too much time and effort to learn a set of
rules with different flavor, just to get the environment set up.

However, things have changed.

The release of WSL (Windows Subsystem on Linux) in Windows 10 was like silent bomb.
It wasn't really marketed to general public, but it implies the fundamental
change of attitude from Microsoft towards OSS community.

WSL is not a virtual machine. In fact there's no real linux kernel running.
Instead, there is a layer in between that translates linux system calls to
something that windows kernel can handle. Technically, this is seriously phenomenal,
as there's certain things that there's no direct equivalent in Windows.

For example:

Quoted from [MSDN blog](https://blogs.msdn.microsoft.com/wsl/2016/06/08/wsl-system-calls/)

> The Linux fork syscall has no documented equivalent for Windows.
> When a fork syscall is made on WSL, lxss.sys does some of the initial work
> to prepare for copying the process.
> It then calls internal NT APIs to create the process with the correct semantics
> and create a thread in the process with an identical register context.
> Finally, it does some additional work to complete copying the process
> and resumes the new process so it can begin executing.

And another one regarding [WSL file system](https://blogs.msdn.microsoft.com/wsl/2016/06/15/wsl-file-system-support/):

> The Windows Subsystem for Linux must translate various Linux file system operations
> into NT kernel operations. WSL must provide a place where Linux system files can exist
> with all the functionality required for that including Linux permissions,
> symbolic links and other special files such as FIFOs;
> it must provide access to the Windows volumes on your system;
> and it must provide special file systems such as ProcFs.

And now it even supports [interop](https://docs.microsoft.com/en-us/windows/wsl/interop)
after the Fall Creators update. This means if you type in `notepad.exe`,
it would literally open notepad for you. Not very exciting but beyond that you could
do

```shell
# copy stuff to clipboard
echo 'foo bar' | clip.exe

# open a file in windows using default associated program
cmd.exe /C start image.png
```

**Awesome, but what's our original topic?**

<!-- more -->

## Enable WSL

Ok, to use WSL, you'd need to enable it first.

*// Make sure you are using Windows 10 :)*

If you are running windows **earlier than 1709**, the setup would be like this:

1. Press Windows key. Type in "Turn windows features on or off" and click on the option that shows up.
2. Turn on WSL

    {% asset_img WSL.png %}

3. Reboot system. You will now have "Bash on Ubuntu on Windows" in your Start Menu.

If you are running version **>= 1709**, just search for "Ubuntu"
or other available distributions like "Debian" or "OpenSUSE" in Microsoft Store.

## Throw Away Cmd

The long lived cmd.exe in windows is not something people would generally like.

If you want to have something close to iTerm2 on Mac or Yakuake on KDE,
you can try [ConEmu](https://conemu.github.io/) (see title image).

ConEmu allows for creating tabs (Win + Shift + W),
and splitting windows (Ctrl + Shift + O/E). Alternatively you can use tmux.

I personally enable the Quake style which allows me to hit `Ctrl + ~` to bring it down.

ConEmu does not seem to have start up with Windows option but you can get around that
by putting the shortcut into Startup folder in Start Menu and set the initial window
option to be "Minimized".

## Basic Setup

### Upgrade Packages

```shell
$ sudo apt -y update
$ sudo apt -y upgrade
$ sudo apt -y dist-upgrade
$ sudo apt -y autoremove
```

### Change to Favorite Shell

By default most distributions would use bash.

If you want to use zsh or other shell:

```shell
$ sudo chsh --shell /bin/zsh <username>
```

or if you want to install oh-my-zsh:

```shell
$ sh -c "$(curl -fsSL https://raw.githubusercontent.com/robbyrussell/oh-my-zsh/master/tools/install.sh)"
```

### Mount Network Drives

Ubuntu on windows should have mounted all local disks for you under `/mnt`.
In case you need to mount a network drive like NAS:

```shell
$ sudo mount -t drvfs Z: /mnt/z
```

## Some Advanced Tweaks You Might Want

### Disabling bell

By default you'll hear an annoying "dang" every time you tab complete.
That is associated with the "Critical Stop" sound config in windows.
To stop it is shell specific but generally:

For bash, put this into `.bashrc`

```bash
set bell-style none
```

For zsh, this works for me in `.zshrc`

```bash
unsetopt beep
```

### Stop Windows From Sharing PATH

By default Windows would copy PATH variables to WSL. This could be quite annoying
if you use tools like pyenv, rvm or nvm and you also have python, ruby, or node installed
in Windows as typically the stuff from Windows will take priority.

To fix that you can create a DWORD `AppendNtPath` under
`HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Lxss` and set the value to `0`.

**Update:** The above trick seems to only work for legacy WSL (aka Bash on Ubuntu on Windows).
For new users, create a DWORD `DistributionFlags` with value `fffffffd` under `HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\LxssManager`.
Then go to Services and restart the LxssManager service.

This is undocumented but described in [WSL#2048](https://github.com/Microsoft/WSL/issues/2048).

### Allow Linux to Open File Using Preferred Application in Windows

This is quite useful if you just want to say check an image as WSL is not shipped with a desktop.
By default the `xdg-open` binary can be used in linux but WSL is not shipped with that either.

Luckily as WSL supports interop, there's a trick:

1. Create a file `/usr/bin/xdg-open` with content

    ```bash
    #!/usr/bin/env sh
    /mnt/c/Windows/System32/cmd.exe /C start "$1"
    ```

2. Make it executable:

    ```shell
    $ sudo chmod +x /usr/bin/xdg-open
    ```

3. Use it:

    ```shell
    $ xdg-open a.png
    ```

### Call VSCode from Linux

You can technically get everything done with vi, but sometimes it's easier to just use a GUI.

For VSCode Mac version there's an option to install it to terminal, but it just doesn't exist in Windows.

But with WSL interop, just put this in shell rc file:

```bash
alias code /mnt/c/Program\ Files/Microsoft\ VS\ Code/Code.exe
```

To use it:

```shell
$ code path/to/my/file
```

### Install Python/Node/Ruby

I use pyenv and it's the same as if you are in normal linux:

```shell
$ curl -L https://github.com/pyenv/pyenv-installer/raw/master/bin/pyenv-installer | zsh
pyenv install 3.6.5
pyenv shell 3.6.5
```

Similar solution can be used for node and ruby using nvm and rvm respectively.
