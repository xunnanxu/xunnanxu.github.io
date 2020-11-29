---
title: >-
  PXE Boot Diskless Raspberry Pi 4 With Ubuntu, Ubiquiti and Synology (2):
  Config TFTP and NFS mounts
date: 2020-11-28 21:37:17
tags:
- linux
- raspberry
- network
---

Once we get the DHCP part set up, here comes the exciting part - to actually install the Linux distro and boot the Pi using it instead of the vanilla 32-bit Raspberry Pi OS.

Now our Pi is still stuck at the initial screen, but don't worry, as long as it is trying to read the tftp path we have made progress.

## Enable TFTP on the Server Side

Here I will be using the Synology NAS server as the file system server.

Synology offers tftp support in file sharing directly. On the other hand, it's also fairly straightforward to set up a TFTP server using a Linux server. One thing important is to remember the tftp root directory. That will be used in the next step to copy over the boot files to.

Under that directory create the Pi corresponding directory like

```
<tftp root>/123456789
```

`123456789` refers to last 9 chars of serial no. Pi's bootloader by default will load from there.


## Create the TFTP boot directory

We need to first grab the Linux distro from an image.

Here I picked Ubuntu 20.04 LTS which is "officially" supported. Technically this is probably not the best option as the OS itself includes a lot of things that we may not actually need and the size is pretty bulky. On the other end the Alpine one is very skinny and lacks some of the tooling we may need initially. For raspberry, unfortunately each distro may be slightly different (in terms of boot) so while you are free to choose whatever you want, YMMV.

Flash the image into the SD card and we'll get 2 partitions - boot and root.

In general, it's a good idea to first boot the system using the SD card just in case there's some essential setup we need to complete ahead of time. After that, the remaining Pi boards can replicate the same set of files with minor tweaks.

<!-- more -->

After that use `rsync` to copy the boot files:

```
sudo rsync -xa /boot 192.168.1.60:<tftp root>/123456789/
```

Here we need to perform some cleanup.

Pi will need a few critical files during the boot process.

`start4.elf`, `bcm2711-rpi-4-b.dtb`, `dtb` these are the firmware files
`config.txt`, `usercfg.txt`, `syscfg.txt` these are the config files to locate the kernel files and related configs
`vmlinuz`, `System.map`, `initrd.img` Linux kernel files
`cmdline.txt` contains config params to pass to the kernel

The overall `boot` directory structure would eventually look roughly like this:

```
-rwxr--r--   1 root  root     46612 Sep  7 22:20 bcm2711-rpi-4-b.dtb
-rwxr--r--   1 root  root       184 Sep 13 14:56 cmdline.txt
-rw-r--r--   1 root  root    218826 Oct 15 06:16 config-5.4.0-1022-raspi
-rwxr--r--   1 root  root      1189 Nov 27 13:50 config.txt
lrwxr--r--   1 root  root        43 Oct 21 23:47 dtb -> dtbs/5.4.0-1022-raspi/./bcm2711-rpi-4-b.dtb
lrwxr--r--   1 root  root        43 Oct 21 23:47 dtb-5.4.0-1022-raspi -> dtbs/5.4.0-1022-raspi/./bcm2711-rpi-4-b.dtb
drwxr--r--   8 root  root      4096 Oct 21 23:45 dtbs
drwxr--r--   8 root  root      4096 Sep 13 15:13 firmware
-rwxr--r--   1 root  root      5405 Sep  7 22:20 fixup4.dat
lrwxr--r--   1 root  root        27 Oct 21 23:46 initrd.img -> initrd.img-5.4.0-1022-raspi
-rw-r--r--   1 root  root  29325769 Oct 21 23:47 initrd.img-5.4.0-1022-raspi
lrwxr--r--   1 root  root        27 Oct 21 23:46 initrd.img.old -> initrd.img-5.4.0-1021-raspi
-rwxr--r--   1 root  root   2272992 Sep  7 22:21 start4.elf
-rwxr--r--   1 root  root       327 Sep  7 22:21 syscfg.txt
-rw-------   1 root  root   4164641 Oct 15 06:16 System.map-5.4.0-1022-raspi
-rwxr--r--   1 root  root       200 Sep  7 22:21 usercfg.txt
lrwxr--r--   1 root  root        24 Oct 21 23:46 vmlinuz -> vmlinuz-5.4.0-1022-raspi
-rwx------   1 root  root   8306127 Oct  5 02:16 vmlinuz-5.4.0-1022-raspi
-rwx------   1 root  root  25907712 Oct 15 10:16 vmlinux-5.4.0-1022-raspi
lrwxr--r--   1 root  root        24 Oct 21 23:46 vmlinuz.old -> vmlinuz-5.4.0-1021-raspi
```

We need to make a few modifications here.

### Uncompress the Linux kernel vmlinuz

**Pitfall #2: Pi does not uncompress the vmlinuz kernel file**

The typical linux kernel vmlinuz is a gzipped executable that's initially loaded into the memory. However Pi's bootloader somehow does not uncompress it and as a result upon boot it would be stuck in rainbow screen.

Before uncompressing, be aware that some Linux distro may have a non-0 offset of the actual executable. We can check via `od`. A gzip file has the header `1f 8b 08 00`.

```
sudo od -A d -t x1 vmlinuz-5.4.0-1022-raspi | grep '1f 8b 08 00'

0000000 1f 8b 08 00 00 00 00 00 02 03 ec 5c 0d 74 14 55
```

Here the offset is `0000000` and hence we can just do

```
zcat vmlinuz-5.4.0-1022-raspi > vmlinux-5.4.0-1022-raspi
```

### Specify the kernel file location in config

**Pitfall #3: The default Uboot config does not work**

I didn't verify other distros but at least with the ubuntu image, the default config is to use uboot. However with netboot config, it would be stuck locating the kernel and other stuff. So here we will tell Pi to boot directly with the vmlinux file we just uncompressed.

So here we will comment out the original entries and just specify the kernel directly in `all` section:
```
[pi4]                            
# kernel=uboot_rpi_4.bin
max_framebuffers=2
                                 
[pi2]                            
# kernel=uboot_rpi_2.bin
                                 
[pi3]                            
# kernel=uboot_rpi_3.bin
                                 
[all]                            
arm_64bit=1                      
device_tree_address=0x03000000
kernel=vmlinux-5.4.0-1022-raspi  
initramfs initrd.img-5.4.0-1022-raspi followkernel
```

Here we are sort of breaking the best practice by specifying the fixed version here so we are not getting updated kernel. We are doing this because the kernel needs to be uncompressed and `initrd` needs to match the version. Technically the kernel update process can include the uncompression as well but that would be a TODO item.

### Update cmdline.txt

Here we need to tell the kernel how to mount the root fs.

Since we are going to set up the diskless boot we will mount via nfs.

The cmdline.txt would roughly be like:
```
net.ifnames=0 dwc_otg.lpm_enable=0 console=serial0,115200 console=tty1 root=/dev/nfs nfsroot=192.168.1.60:<nfs root>/raspberry/123456789 ip=dhcp elevator=deadline rootwait fixrtc rw
```

Here the nfs root is the directory in the NAS. `192.168.1.60` is the NAS IP. `123456789` again is the Pi serial but it technically could be anything unique. We are setting it like that for consistency.

So far we have finished configuring the tftp side.

## Create NFS root fs

### Copy over Files

Similar to boot directory we will rsync the root fs:

```
sudo rsync -xa / 192.168.1.60:<nfs root>/raspberry/123456789
```

Here `-x` is important to ensure we don't copy anything mounted.
Particularly the `boot` directory would be left out and we can either make a soft link back to the one under tftp, or mount it in `/etc/fstab` explicitly.


### Update /etc/fstab

Update the one we just copied over to NAS nfs directory as that would be read upon next boot.

```                                         
192.168.1.60:<nfs root>/raspberry/123456789   /       nfs     defaults,rw,nolock   0  0
tmpfs   /tmp    tmpfs   defaults    0   0
tmpfs   /var/tmp    tmpfs   defaults    0   0
tmpfs   /var/run    tmpfs   defaults    0   0
```

Here we'll mount some of the tmp dirs to tmpfs (mem fs).

The root fs is technically not required as in `cmdline.txt` the kernel already mounts it as `rw` but here we are explicitly marking it so and turning off disk check.

### Enable NFS Server

For Synology this part is easy, in file sharing there's an option to turn on NFS in File Services.

**Remember to turn off NFS squash in shared file**

<img src="{% asset_path nfs-permission.png %}" />

## Testing and Troubleshooting

So far we have completed the necessary steps. It's time to unplug the Pi, remove the microSD card and reboot.

The Pi should tell us it fails reading the card and will try PXE boot next.

On the first screen it should show what files it's trying to read and if it's stuck on some of them check the tftp logs to see if they are placed properly.

Next it will show the rainbow screen like this

<img src="{% asset_path rainbow.jpg %}" />

If you see this, that means Pi's GPU has been properly initialized and next it would try to load the kernel.

If the screen is stuck in this step, go back to check if the kernel file is properly uncompressed and referred to in config.txt file.

This screen should last for a few seconds to tens of seconds depending on network speed. After that the Linux kernel executable should take it over to init other stuff and mount the NFS root.

initramfs would be loaded at this moment and if the version does not match you might get some random weird errors. If NFS is not mounted correctly, it would tell so.

With Ubuntu depending on your actual env, there may be a few other extra non critical errors we need to fix like cloud-init but typically they would not block the startup process.

Now we should be able to ssh into the system with the username `ubuntu`.

Congrats we have finished the netboot setup and this can be replicated to other Pis with the same process.