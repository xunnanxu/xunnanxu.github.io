---
title: 'Make Wireless BackHaul Great Again: Disable Orbi 2.4G Backhaul'
date: 2020-04-04 21:14:57
tags: wifi, openwrt
---

## TL;DR;
I was able to "break" Orbi's 2.4G backhaul fallback
and hence force it onto 5G.

So instead of this

<img src="{% asset_path slowspeed.png %}" style="width: 400px" />

I got this:

<img src="{% asset_path speed.png %}" style="width: 400px" />

The solution isn't clean. Basically telnet to the satellite and then
```console
root@RBS20:/# config set wlg_sta_ssid=<original ssid>_disabled
root@RBS20:/# config commit 
```

Then reboot.

More details and investigation<br>
↓

<!-- more -->

## Background

A while back, I got the Netgear Orbi [RBK20](https://www.netgear.com/support/product/RBK20.aspx)
to replace my original not so reliable powerline setup.

{% asset_img RBK20.png %}

It's a wifi mesh solution that aims to solve the problem
where traditional single pointer router fails -
to provide good signal coverage
in complex indoor environment with walls in between rooms.
This is esp. important in the AC world where
the 5G signal falls short as it tends to be more easily blocked/
than 2.4G.

One thing worth mentioning though is that Orbi isn't
a true mesh system, that is, to support 802.11s mesh standard.
A true mesh system allows satellites to cooperate together
through a routing algorithm to find the optimal data transfer path
but Orbi basically supports only star topology or daisy chaining.
That said though, in practice, some of the "advanced" true mesh systems
on the other hand suffer from lack of dedicated backhaul channel
for inter satellite uplink (e.g. Google Wifi) and hence actually
perform much worse in reality as they essentially just become
more advanced repeaters.

## Problem

In order for Orbi to have max power, we need to
ensure that Orbi has the dedicated backhaul operate in 5G mode,
otherwise anything connected to satellites would be bound to
2.4G speed which is 192Mbps.

It's not unusable technically but it sort of defeats the purpose.
What makes things worse is that Netgear decides on a strategy
that if 5G backhaul isn't stable, it would fall back onto 2.4G,
which isn't dedicated but shared with regular 2.4G radio.
This isn't a bad idea per se as home layout may be complex so
they sacrifice throughtput in favor of usability in certain
scenarios.

However this setup doesn't work well in practice.
For whatever reason, the system would fall back onto 2.4G
randomly even if 5G signal is perfectly fine. And the only
way to fix that would be to power cycle the satellite.

## Investigation

Since Orbi is OpenWRT based, I took a look at the configs
that potentially control the behavior and here they are:

```console
root@RBS20:/# uci show | grep WiFiLink
...
repacd.WiFiLink.RSSIThresholdFar='-75'
repacd.WiFiLink.RSSIThresholdFar5g='-82'
repacd.WiFiLink.RSSIThresholdFar24g='-76'
repacd.WiFiLink.RSSIThresholdNear='-60'
repacd.WiFiLink.RSSIThresholdMin='-75'
repacd.WiFiLink.RSSIThresholdPrefer2GBackhaul='-82'
repacd.WiFiLink.2GBackhaulSwitchDownTime='10'
repacd.WiFiLink.MaxMeasuringStateAttempts='30'
repacd.WiFiLink.DaisyChain='1'
repacd.WiFiLink.RateNumMeasurements='5'
repacd.WiFiLink.RateThresholdMin5GInPercent='35'
repacd.WiFiLink.RateThresholdMax5GInPercent='95'
repacd.WiFiLink.RateThresholdPrefer2GBackhaulInPercent='5'
repacd.WiFiLink.5GBackhaulBadlinkTimeout='60'
repacd.WiFiLink.BSSIDAssociationTimeout='170'
repacd.WiFiLink.RateScalingFactor='85'
repacd.WiFiLink.5GBackhaulEvalTimeShort='330'
repacd.WiFiLink.5GBackhaulEvalTimeLong='1800'
repacd.WiFiLink.2GBackhaulEvalTime='1800'
...
```

So in theory 2G backhaul should only be preferred
after signal drops below -82dbm or rate is below 5%/35%.
However in practice this almost is never the case.

```console
# From router side:
root@RBR20:/# wlanconfig ath11 list
ADDR               AID CHAN TXRATE RXRATE RSSI MINRSSI MAXRSSI IDLE  TXSEQ  RXSEQ  CAPS        ACAPS
 ERP    STATE MAXRATE(DOT11) HTCAPS ASSOCTIME    IEs   MODE                   PSMODE
                     1  157 866M    780M   51      44      58    0      0   65535   EPs         0
   b              0           AWPSM 18:46:39     RSN WME IEEE80211_MODE_11AC_VHT80   0
```

RSSI here is 51 which indicates roughly -44dbm
which is perfectly fine. It's possible that the number would
fluctuate during operation but as you see the min value
is still way above the threshold. Also in practice,
once Orbi picks 2.4G it will stick there which doesn't make sense
but since Orbi's software isn't open sourced there's no way to know
exactly how it messes things up (looking at you Netgear developers).

## A Hacky Solution

### Enable Telnet
Go to http://&lt;satellite ip&gt;/debug.htm, log in with router username & password
and check "Enable Telnet".

{% asset_img telnet.png %}

### Initial Attempt
Since we cannot alter Netgear's software behavior directly,
we have to somehow break the 2.4G connection to force it onto 5G.

My initial thought was to disable the 2.4G wifi interface.
(Spoiler: this does not work somehow).

This is doable via OpenWRT's config system.

```console
# Show all wifi interfaces. The 2.4G is already disabled here but in normal operation it will show something.
root@RBS20:/# iwconfig
ath01     IEEE 802.11b  ESSID:"NETGEAR_ORBI_hidden52"
          Mode:Managed  Frequency:2.412 GHz  Access Point: Not-Associated
          Bit Rate:0 kb/s   Tx-Power:25 dBm
          RTS thr:off   Fragment thr:off
          Power Management:off
          Link Quality=0/94  Signal level=-95 dBm  Noise level=-95 dBm
          Rx invalid nwid:0  Rx invalid crypt:0  Rx invalid frag:0
          Tx excessive retries:0  Invalid misc:0   Missed beacon:0

root@RBS20:/# vi /etc/config/wireless
config wifi-iface
        option device 'wifi0'
        option network '0'
        option bridge 'br0'
        option mode 'sta'
        option wds '1'
        option athnewind '1'
        option vap_ind '0'
        option backhaul '1'
        option wsplcd_unmanaged '1'
        option repacd_security_unmanaged '1'
        option dropmdns '0'
        option ssid 'NETGEAR_ORBI_hidden52'
        option encryption 'psk2+ccmp'
        option ifname 'ath01'
        option wps_config 'virtual_push_button physical_push_button'
        option wps_pbc '1'
        option dyn_bw_rts '0'
        option disabled '0'
```

^ From there we can see `ath01` is bound to physical interface `wifi0`.
We can just change the disabled value from 0 to 1.
Then `uci commit` will persist the value.

However for some reason, Orbi will restore values in OpenWRT config,
presumably for system integrity reason. YMMV but at least this does
not work for RBK20 system.

### The Hacky Attempt
While Orbi restores uci configs, it does keep its own configs
that are alterable via `config`.

Then essentially the solution becomes that we can change the 2.4G
backhaul SSID such that it cannot find the right one.

In my system the original SSID is `NETGEAR_ORBI_hidden52` from
`iwconfig`.
We can grab all related configs from

```console
root@RBS20:/# config show | grep hidden52
wlg_ap_bh_ssid=NETGEAR_ORBI_hidden52
wla_ap_bh_ssid=NETGEAR_ORBI_hidden52
wla_sta_ssid=NETGEAR_ORBI_hidden52
wlg_sta_ssid=NETGEAR_ORBI_hidden52
```

Here anything starts with `wla` is 5G and `wlg` is 2.4G.

Then we can do

```console
root@RBS20:/# config set wlg_sta_ssid=NETGEAR_ORBI_hidden52_disabled
root@RBS20:/# config commit
```

The `_disabled` suffix is arbitrary with the idea to prevent
Orbi from connecting to router via 2.4G.

`wlg_ap_bh_ssid` does not need to be set. The `ap` setup will
automatically follow the `sta` setup.

`nvram show | grep ssid` should now show the persisted value.

In RBS20, if you use `reboot` to restart the system,
it will somehow get stuck with pink led light.
So I always just power cycle it, which works just fine.

To confirm this works, on satellite side, once restarted,
`iwconfig` should show the new SSID and signal strength should be
-95dbm indicating it's disconnected.

Enable Telnet in router and log into it. 
```
# ath01 is 2.4G wifi interface. It should have nothing connected now.
root@RBR20:/# wlanconfig ath01 list
# ath11 is 5G. It should have satellite(s) connected.
root@RBR20:/# wlanconfig ath11 list
ADDR               AID CHAN TXRATE RXRATE RSSI MINRSSI MAXRSSI IDLE  TXSEQ  RXSEQ  CAPS        ACAPS
 ERP    STATE MAXRATE(DOT11) HTCAPS ASSOCTIME    IEs   MODE                   PSMODE
                     1  157 866M    780M   51      44      58    0      0   65535   EPs         0
   b              0           AWPSM 19:26:27     RSN WME IEEE80211_MODE_11AC_VHT80   0
```
