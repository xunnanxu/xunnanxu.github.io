---
title: "The Spec Mess: Journey to Enable M1 Pro + 2 2K-monitors @ 100Hz over One Single Thunderbolt Cable"
date: 2025-09-01 16:44:36
tags:
    - pcparts
    - setup
prompts: |
    Write a blog post with the title

    "The Spec Mess: Journey to Enable M1 Pro + 2 2K-monitors @ 100Hz w/ One Single Thunderbolt Cable"
    
    Start with the intro:
    
    Recently I've been looking into giving my WFH setup some upgrade. I already have a 38inch AW3821DW monitor with a spec of 3800x1600 @ 144Hz, connected to the M1 Pro Macbook Pro via a TB3 dock (StarTech TB3DOCK2DPPD that I bought years ago pre-pandemic). I'm trying to add a side monitor to it with likely a QHD spec (2560x1440) @ 100Hz.
    Then I suddenly realized one thing, if I want to keep my connection topology as is (wire up all devices to my dock and connect it to the Mac using a single TB cable) - would that work?
    
    Then breakdown the sections as follows:
    1. RGB 444 vs YCbCr422
    2. The bandwidth calculation
    3. DP 1.4 vs 1.2 and relationship with Thunderbolt version
    4. M1 Pro limitation and the need for downstream thunderbolt port
    5. Summary Put the final output into a code block with raw markdown to avoid it getting formatted on the fly.
    
    List all the references in the final section like
    ```
    ## References
    [1] [XX](https://yy)
    [2] ...
    ```
---

Recently I've been looking into giving my WFH setup some upgrade.
I already have a 38inch AW3821DW monitor running **3800x1600 @ 144Hz**, connected to the **M1 Pro Macbook Pro** via a **TB3 dock** (StarTech TB3DOCK2DPPD that I bought years ago pre-pandemic). I'm trying to add a side monitor to it with likely a QHD spec **(2560x1440) @ 100Hz**.

{% mermaid %}
graph TD;
    M1[M1 Pro]-->TBDock[TB Dock]
    TBDock-->AW3821DW[AW3821DW 3800x1600 @ 144Hz]
    TBDock-->QHD[QHD 2560x1440 @ 100Hz]
{% endmermaid %}

Then I suddenly realized one thing, if I want to keep my connection topology as is (wire up all devices to my dock and connect it to the Mac using a single TB cable) - would that work?

It turns out it's not that straightforward to average users. And here's why.

---

## 1) RGB 4:4:4 vs YCbCr 4:2:2 Chroma Subsampling

Before doing math, we first need to check the *signal* we want to drive:

- **RGB/YCbCr 4:4:4, 8-bit per channel (bpc)** → **24 bits/pixel**. This is the “no-compromise” desktop signal—full chroma on every pixel. Text looks crisp.
- **YCbCr 4:2:2, 8-bpc** → the chroma (Cb/Cr) is shared between two horizontal pixels, averaging **16 bits/pixel** (≈ 33% less data than 4:4:4). Saves bandwidth, but fine colored edges and UI text soften.
- **YCbCr 4:2:0, 8-bpc** → **12 bits/pixel** (≈ 50% less than 4:4:4). Great for video, not for desktop use.
- **HDR / 10-bpc** pushes each of those up by 25% (e.g., RGB 4:4:4 becomes **30 bits/pixel**).

For SDR productivity monitors, we should **ALWAYS** prefer **RGB 4:4:4** (or YCbCr 4:4:4) at 8-bpc for clear text.
Anything doing chroma subsampling (422) is a no-go as text would have blurred/colored edges. Period.

---

## 2) The bandwidth calculation

For uncompressed links (DisplayPort/HDMI without DSC), a solid back-of-the-envelope is:

$$
\textbf{Signal rate} \approx \text{(Horizontal px)} \times \text{(Vertical px)} \times \text{(Refresh Hz)} \times \text{(bits/pixel)}.
$$

This yields the **active video** payload. Real links also carry blanking intervals and link-layer overhead. Using modern reduced-blanking timings, a **5–10% headroom** usually suffices for comparisons; standards bodies quote separate “link rates” that already include line coding overhead.

Let’s compute the key cases (all at 8-bpc unless noted):

- **One QHD (2560×1440) @ 100 Hz, 4:4:4**  
  $$2560 \times 1440 \times 100 \times 24 \;=\; \mathbf{8.85\ Gbps}$$
  With 10-bpc (30 bpp): **11.06 Gbps**.  
  With 4:2:2 (16 bpp): **5.90 Gbps**.

- **Your ultrawide (3840×1600), 4:4:4**  
  - @ **100 Hz**
    $$3840 \times 1600 \times 100 \times 24 = \mathbf{14.75\ Gbps} $$
  - @ **120 Hz** **17.69 Gbps** (already nudging past DP 1.2’s effective limit once overhead is considered).  
  - @ **144 Hz**: **21.23 Gbps** (firmly beyond DP 1.2; needs DP 1.4/HBR3 and/or DSC support end-to-end).

- **Two monitors together**:  
  - **3840×1600 @ 100 Hz** + **2560×1440 @ 100 Hz** (both 8-bpc 4:4:4) →
    $$14.75 + 8.85 \approx \mathbf{23.6\ Gbps}$$
    This is in the same ballpark as **dual 4K60 8-bpc** (≈ 23.9 Gbps active), which many Thunderbolt 3 docks explicitly support.

**Interpreting against link limits**

- **DisplayPort 1.2 (HBR2)**: Max **17.28 Gbps** payload per DP link. One 2560×1440@100 (8-bpc 4:4:4) fits comfortably. One 3840×1600@100 fits. **3840×1600@120 does not**, and @144 certainly does not.  
- **DisplayPort 1.4 (HBR3)**: Max **25.92 Gbps** payload per DP link. Enough for 3840×1600@120/144 uncompressed in many timing modes, or with DSC when needed.

---

## 3) DP 1.4 vs DP 1.2—and how that relates to Thunderbolt versions

- **DP 1.2 (HBR2)** tops out at 5.4Gbps/lane x 4 - **21.6 Gbps raw / 17.28 Gbps effective** payload.  
- **DP 1.4 (HBR3)** increases the lane rate to 8.1Gbps/lane -> **32.4 Gbps raw / 25.92 Gbps effective** and adds features like **DSC 1.2** for higher-than-link-rate modes.
- **Thunderbolt 3** originally shipped on **Alpine Ridge** controllers that **tunnel DP 1.2** only. Later **Titan Ridge** TB3 silicon can **tunnel DP 1.4**.  
- **Thunderbolt 4** is built on **USB4 v1**; it **mandates** support for **two 4K displays or one 8K display**, functionally aligning with **DP 1.4/HBR3** tunneling end-to-end. (TB4 does not raise the nominal 40 Gbps link rate; it raises the *minimums* OEMs must deliver.)

However, the **StarTech TB3DOCK2DPPD** is an older **Alpine Ridge (JHL6540)** design—i.e., **DP 1.2-only** on its display paths. It still handles **dual-display** by presenting **two DP sinks** to the host TB controller (one on the rear DisplayPort jack, and a **downstream TB3 port**). But each DP hop is capped at **DP 1.2** timings.

---

## 4) M1 Pro limitations and why a **downstream Thunderbolt port** matters

At this moment, it's roughly clear that a TB3 dock is not going to be sufficient bandwidth wise.

However there's a bit more nuance here (and why we actually need a higher-end dock with a **downstream** TB4 port):

- **M1 Pro MacBook Pro (2021)** supports **up to two external displays** over Thunderbolt (each up to 6K60). That’s a *hard* GPU/display-engine limit on count, not just raw bandwidth.
- MacOS does not support DisplayPort MST for extended desktops. In plain English: you can’t split one DP lane group into two independent desktops via an MST hub and expect macOS to see two displays—it will mirror them.  
  **Implication:** to run **two** external monitors over **one cable**, we need a **Thunderbolt dock** that exposes **two independent DP tunnels** (e.g., one physical DP output **plus** a **downstream TB** port for the second display via USB-C→DP).

The **TB3DOCK2DPPD** does exactly that: one native DP port **and** one **downstream TB3** port intended to carry the second display. The constraint, again, is that both of those hops are **DP 1.2** only.

A lot of the lower-end docks, on the other hand, **do NOT carry downstream TB ports** and hence not suited for such setup.

**Putting it together:**  
- To keep the single-cable topology, we should use the dock’s **DP** for one monitor and the **downstream TB3→USB-C/DP** for the other.
- We also need a **DP 1.4-capable TB3/TB4 dock** (Titan Ridge, Goshen Ridge/TB4) to fulfill the bandwidth requirements for the 2 monitors at high refresh rate.

---

## 5) Summary

- **Yes, the single-cable topology can work**—with caveats. On the **Alpine Ridge TB3 dock (DP 1.2)**, run the **AW3821DW at 100 Hz** and the new **2560×1440 at 100 Hz**, both at **8-bpc RGB 4:4:4**.  
- The dock will not do **3840×1600 @ 144 Hz** concurrently with a high-refresh second display; DP 1.2 per-link bandwidth is the blocker.
- Because **macOS lacks MST-Extended**, we also need to ensure the dock provides a **downstream Thunderbolt port**.

---

## References
[1] Apple — *MacBook Pro (14-inch, 2021) Tech Specs* (external display support) – https://support.apple.com/en-us/111902  
[2] Dell — *Alienware AW3821DW product page* (3840×1600 @ 144 Hz over DP) – https://www.dell.com/en-us/shop/alienware-38-curved-gaming-monitor-aw3821dw/apd/210-axvg/monitors-monitor-accessories  
[3] RTINGS — *Chroma Subsampling: 4:4:4 vs 4:2:2 vs 4:2:0* – https://www.rtings.com/tv/learn/chroma-subsampling  
[4] Eaton/Tripp Lite — *DisplayPort explained* (8b/10b vs 128b/132b; effective payloads) – https://www.eaton.com/us/en-us/products/backup-power-ups-surge-it-power-distribution/backup-power-ups-it-power-distribution-resources/cpdi-vertical-marketing/displayport-explained.html  
[5] Cable Matters — *DisplayPort 1.4 vs 1.2: What’s the Difference?* (21.6 vs 32.4 Gbps raw; 17.28 vs 25.92 Gbps payload) – https://www.cablematters.com/Blog/DisplayPort/displayport-1-4-vs-1-2  
[6] Wikipedia — *DisplayPort* (TB3 Alpine Ridge DP 1.2 vs Titan Ridge DP 1.4) – https://en.wikipedia.org/wiki/DisplayPort  
[7] StarTech — *TB3DOCK2DPPD Manual* (identifies **JHL6540 Alpine Ridge** chipset, DP 1.2 heritage) – https://sgcdn.startech.com/005329/media/sets/tb3dock2dppd_manual/tb3dock2dppd_tb3dock2dppu_thunderbolt_3_dock.pdf  
[8] StarTech — *TB3DOCK2DPPD Datasheet* (dual-4K60 via DP + downstream TB3) – https://media.startech.com/cms/pdfs/tb3dock2dppd_datasheet.pdf  
[9] Plugable KB — *MST on macOS (Extended not supported)* – https://kb.plugable.com/understanding-mst-multi-display-setups-with-windows-macos-and-displayport  
[10] Intel — *Thunderbolt 3 vs Thunderbolt 4* (TB4 mandates dual 4K or one 8K) – https://www.intel.com/content/www/us/en/architecture-and-technology/thunderbolt/thunderbolt-3-vs-4.html  
[11] Wikipedia — *USB4* (DP 1.4a tunneling in USB4 v1; DP 2.1 in USB4 v2) – https://en.wikipedia.org/wiki/USB4
