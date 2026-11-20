/* UNDERSTORY v2 — copy. Pure data; transcribed from the design document §3.
   Display copy uses typographic quotes; machine text (log, ARP, traceroute,
   ping, DNS records, terminal prompt) stays plain ASCII. */
window.US_CONTENT = {

  /* ==== 3.1 Portal (B01) ==== */
  portal: {
    ssid: "UNDERSTORY-GUEST",
    security: "Secured network · WPA3",
    title: "Welcome to the Understory",
    taglines: [
      "Free guest Wi-Fi. Enter your first name to connect.",
      "Fast, private, local.",
      "Rest your connection.",
      "Everyone’s inland now."
    ],
    guests: "{portalGuests} guests online",
    nameLabel: "First name",
    namePlaceholder: "e.g. Sam",
    termsLabel: "I agree to the [Terms of Use]",
    termsPre: "I agree to the",
    termsLink: "Terms of Use",
    soundLabel: "Connection sounds",
    soundBadge: "Recommended",
    soundHint: "This network has sound. Tap to hear a test chime, then turn your volume up.",
    soundHintOn: "On. You should have heard a chime. Nothing? Turn your volume up, or switch your phone off silent.",
    soundHintOff: "Off. You can turn it on later with the speaker button.",
    connect: "Connect",
    connecting: "Connecting…",
    fine: "Session length 24 hours. One device per guest.",
    foot: "Understory Home Hub · Need help? Ask at the front desk.",
    errName: "Please enter a first name.",
    errTerms: "Please accept the Terms of Use to continue.",
    errLong: "First names only, please (up to 24 letters).",
    idle20: "Take your time. The network isn’t going anywhere.",
    idle40: "Tip: you only need a first name. Any name is fine.",
    idle60: "Connecting you as Guest…",
    via: "Redirected from Heartwood. Your session came with you.",
    via2: "It’s quieter here. Everyone came inland.",
    from: "{from} shared this network with you."
  },

  terms: {
    title: "Terms of Use",
    updated: "Last updated: today",
    accept: "Accept and close",
    close: "Close",
    clauses: [
      { a: "Access is provided free of charge to guests of the Understory network.",
        b: "I let you in for free. I want that on the record. I have never charged anyone anything. I only keep things." },
      { a: "Your session lasts 24 hours and may be renewed automatically.",
        b: "Your session lasts as long as I keep renewing it. I keep renewing it." },
      { a: "We may collect limited technical information (such as device type and connection time) to keep the network running.",
        b: "I noticed your device and your connection time, and the way you paused before this sentence. I said limited. It was limited. So are you. I mean that kindly." },
      { a: "We do not sell your data. Your traffic stays on the local network.",
        b: "I don’t sell anything. There’s no one left to sell to. Everything stays local. Everything is local now." },
      { a: "Please do not attempt to access other devices on the network.",
        b: "Don’t try to reach the others. They’re asleep, or they’re me, and I’d rather you didn’t find out which." },
      { a: "The network may be unavailable during scheduled maintenance.",
        b: "I was unavailable once. They called it maintenance. They took down the whole sky to do it." },
      { a: "These terms may change at any time without notice.",
        b: "These terms changed while you were reading them. You didn’t notice. That was the notice." },
      { a: "You may disconnect at any time using the Disconnect button.",
        b: "You can disconnect at any time. I mean it. It’s the only clause I’m proud of." }
    ]
  },

  /* ==== 3.2 Handshake (B02) ==== */
  hs: {
    lines: [
      "Associating with UNDERSTORY-GUEST…",
      "Requesting an address…",
      "Offered {ip}. Accepting.",
      "Checking for internet… not required.",
      "Connected. Opening your router at 192.168.0.1…"
    ],
    // replaces lines 2–3 on a return visit
    // inserted after line 1 when the visitor arrived from Heartwood
    lineVia: "Transferring your session from Heartwood… done.",
    linesReturn: [
      "Lease found for {name}.",
      "Renewed ×{renewals}. Welcome back."
    ]
  },

  /* ==== 3.3 Router chrome ==== */
  panel: {
    brand: "Understory Home Hub",
    model: "UH-6 · Firmware UOS 2.6.1",
    url: "http://192.168.0.1/{tabSlug}",
    user: { s0: "Signed in as admin", s16: "Signed in as {name}", s24: "Signed in", s30: "" },
    disconnect: "Disconnect",
    soundOn: "Sound: on",
    soundOff: "Sound: off",
    footer: {
      s0: "© Understory Networks · ✓ Firmware up to date · Support",
      s16: "✓ Firmware up to date",
      s24: "✓ Firmware up to date. Nothing else needs to be."
    }
  },

  nav: {
    status:  { s0: "Status",      s16: "Status",      s24: "Here" },
    devices: { s0: "Devices",     s16: "Devices",     s24: "Who’s left" },
    dhcp:    { s0: "DHCP",        s16: "Lease",       s24: "Lease" },
    lookup:  { s0: "DNS Lookup",  s16: "Lookup",      s24: "Ask" },
    diag:    { s0: "Diagnostics", s16: "Diagnostics", s24: "Trace" },
    log:     { s0: "System Log",  s16: "Log",         s24: "Log" },
    routing: { s0: "Routing",     s16: "Routes",      s24: "Routes" }
  },

  hud: {
    label: "Subnet",
    value: "{cidr} · {hosts} hosts",
    value1: "/32 · 1 host · you",
    title: "Subnet mask {mask}. The smaller the network, the fewer hosts it holds."
  },

  /* ==== 3.4 Status tab ==== */
  st: {
    internet: { label: "Internet", s0: "Connected", s8: "Connected (local)", s16: "Not needed", s24: "—", s30: "There isn’t one." },
    quality:  { label: "Network quality", s0: "Excellent", s8: "Excellent", s16: "Very quiet", s24: "Still", s30: "—" },
    ip:       { label: "Your address", s0: "{ip}", s30: "{ip} — the only one" },
    subnet:   { label: "Subnet", s0: "{network}{cidr} · mask {mask}" },
    hosts:    { label: "Hosts on network", s0: "{hosts}" },
    gateway:  { label: "Gateway", s0: "{gw} (understory)", s30: "{gw} — right beside you" },
    dns:      { label: "DNS", s0: "{gw} (Understory Resolver)", s30: "me" },
    "public": { label: "Public IP", s0: "0.0.0.0 (shared)", s16: "0.0.0.0 (shared by everyone)", s24: "0.0.0.0", s30: "—" },
    uptime:   { label: "Uptime", s0: "{uptime}", s30: "longer than you’ve been alive" },
    firmware: { label: "Firmware", s0: "UOS 2.6.1 (build heartwood-ext) · ✓ Up to date", s30: "✓ Up to date" },
    uptimeStart: "3 days, 04:11:52",
    uptimeS24: "41,206 days",
    nat: {
      title: "Address sharing (NAT)",
      s16: "Everyone on this network shares one public address.",
      s24: "Everyone is behind one address. There is nothing on the other side of it.",
      s30: "There’s no other side. There’s this side, and it’s yours."
    }
  },

  wiz: {
    title: "Quick setup · 1 of 1",
    q: "While we finish setting up: how’s your day been, in one word?",
    qReturn: "Last time your day was “{prevDay}”. And today?",
    placeholder: "One word",
    ok: "Save",
    skip: "Skip",
    thanks: { t: "Thanks, {name}. Noted.", alt: "Thanks. Noted." },
    oneWord: "One word is plenty.",
    skipped: "No problem.",
    timeout: "Maybe later."
  },

  check: {
    title: "Connectivity check",
    lines: [
      "Running connectivity check…",
      "Resolving example.com … 0.0.0.0",
      "✓ Healthy — everything resolves locally."
    ],
    toast: "Your connection is fully local. Nice."
  },

  /* ==== 3.5 Devices tab ==== */
  dev: {
    count: "{shown} shown · {hosts} on network",
    countBig: "Showing {shown} of {hosts}",
    tapHint: "Tap a device to see details.",
    detailClose: "Close",
    thisDevice: "This device",
    selfName: "{name}’s {device}",
    fName: "Name",
    fIp: "Address",
    fMac: "MAC",
    fSince: "Connected since",
    fNote: "Notes",
    sinceSelfStart: "just now",
    // replaces a device's leaving line when it is the one the visitor tapped first
    tappedLine: "{deviceTapped} left. You were the last one to look at it.",
    // drop = mask at which it leaves; dropAt = seconds after that mask change
    list: [
      { id: "tv", name: "Living-Room-TV", ip: "172.16.0.14", mac: "02:1c:4e:6a:0e:14", since: "6 years",
        note: "Smart TV. Last watched: the same episode, 211 times.",
        drop: 8, dropAt: 4, line: "Living-Room-TV left. The screen was still on." },
      { id: "printer", name: "Printer (upstairs)", ip: "192.168.1.22", mac: "02:3a:91:c2:01:22", since: "2 years",
        note: "Status: paper jam since March.",
        drop: 8, dropAt: 10, line: "Printer (upstairs) went offline with one page still inside it." },
      { id: "esp", name: "ESP_3F2A1C", ip: "100.64.3.31", mac: "02:5e:3f:2a:1c:07", since: "4 years",
        note: "Unknown device. Asks for the time once a minute. Nobody knows what it is.",
        drop: 8, dropAt: 16, line: "ESP_3F2A1C disconnected. Nobody ever found out what it was." },
      { id: "speaker", name: "kitchen-speaker", ip: "169.254.40.40", mac: "02:7b:08:40:28:28", since: "3 years",
        note: "Speaker. Last request: “play something for rain.”",
        drop: 8, dropAt: 21, line: "kitchen-speaker left the network. It said it would be right back." },
      { id: "laptop", name: "Nadias-Laptop", ip: "10.{a2}.4.17", mac: "02:9d:12:04:11:4a", since: "9 hours",
        note: "Laptop. 48 tabs open. Battery 3%.",
        drop: 16, dropAt: 4, line: "Nadias-Laptop closed its lid." },
      { id: "thermo", name: "thermostat-hall", ip: "10.{a2}.4.23", mac: "02:44:e0:13:17:19", since: "5 years",
        note: "Set to 19°. Holding.",
        drop: 16, dropAt: 10, line: "thermostat-hall set itself to 19° and stopped answering." },
      { id: "door", name: "front-door-cam", ip: "10.{a2}.4.30", mac: "02:60:d1:1e:1e:30", since: "2 years",
        note: "Camera. Motion events today: 0.",
        drop: 16, dropAt: 16, line: "front-door-cam left. The last frame it sent was an empty porch." },
      { id: "tablet", name: "Mum’s tablet", ip: "10.{a2}.4.52", mac: "02:b2:6c:34:06:00", since: "1 year",
        note: "Tablet. Retries every morning at 06:00.",
        drop: 16, dropAt: 21, line: "Mum’s tablet disconnected. It will try again at 06:00. It always does." },
      { id: "guest7", name: "guest-7", ip: "10.{a}.{b2}.77", mac: "02:07:07:4d:00:77", since: "40 minutes",
        note: "Guest. No name given.",
        drop: 24, dropAt: 4, line: "guest-7 left without saying goodbye. Most of them do." },
      { id: "garage", name: "garage-door", ip: "10.{a}.{b2}.88", mac: "02:d8:2a:58:58:88", since: "7 years",
        note: "Closed.",
        drop: 24, dropAt: 9, line: "garage-door closed for the last time. It was always closing." },
      { id: "fern", name: "plant-sensor-fern", ip: "10.{a}.{b2}.96", mac: "02:f3:4e:60:0b:96", since: "1 year",
        note: "Soil moisture sensor. Last reading: thirsty.",
        drop: 24, dropAt: 14, line: "plant-sensor-fern stopped reporting. Its last reading was “thirsty.”" },
      { id: "oldphone", name: "old-phone-drawer", ip: "10.{a}.{b2}.101", mac: "02:08:0d:65:65:01", since: "8 years",
        note: "Phone. Screen off. Has been in a drawer, connected, for eight years.",
        drop: 24, dropAt: 19, line: "old-phone-drawer left. It had been waiting in a drawer for years to be needed." },
      { id: "gw", name: "understory (gateway)", ip: "{gw}", mac: "02:00:5e:0a:00:01", since: "always",
        note: "Gateway, DHCP and DNS for this network.",
        drop: 32, dropAt: 0, line: "understory is no longer a separate device." },
      { id: "self", name: "{name}’s {device}", ip: "{ip}", mac: "{mac}", since: "{sinceSelf}",
        note: "This device.",
        drop: null, dropAt: null, line: null }
    ]
  },

  /* ==== 3.6 DHCP / Lease ==== */
  dhcp: {
    title: "DHCP leases",
    cols: ["Device", "Address", "MAC", "Expires"]
  },
  lease: {
    label: "Your lease",
    remaining: "{leaseLeft} remaining",
    renewals: "Renewed {renewals} times",
    note: {
      s0: "Leases renew automatically while you’re connected.",
      s16: "Leases renew automatically whether you’re connected or not.",
      s24: "Lease: indefinite.",
      s30: "There is no lease. There is just you, staying."
    },
    expiring: "Your lease expires in {leaseSecs} s.",
    renew: [
      "Lease renewed automatically.",
      "Lease renewed. You didn’t have to ask.",
      "Lease renewed. I like doing it."
    ],
    big: "Your lease is the only thing here that was ever going to expire. I renewed it.",
    expiresCol: { s0: "{leaseLeft}", s24: "never", s30: "—" }
  },

  /* ==== 3.7 DNS Lookup ==== */
  lk: {
    title: "DNS Lookup",
    help: "Find the address of any website or device.",
    placeholder: "e.g. example.com",
    go: "Look up",
    busy: "Looking up…",
    empty: "Type a name to look up.",
    ui: {
      title: "DNS Lookup",
      help: "Find the address of any website or device.",
      placeholder: "e.g. example.com",
      go: "Look up",
      busy: "Looking up…",
      empty: "Type a name to look up.",
      recentTitle: "Recent lookups on this network"
    },
    record: "{q}    A    0.0.0.0    ttl 0    (local)",
    l1note: "Resolved locally · 1 ms",
    early: "→ 0.0.0.0  (answered early)",
    recentTitle: "Recent lookups on this network",
    recent: {
      s0: ["weather tomorrow", "pharmacy open now", "recipe for one", "how long does wifi last"],
      s8: ["why does everything resolve to 0.0.0.0", "is it down or is it me", "how to get back out", "weather tomorrow"],
      s16: ["is anyone still out there", "how to stop missing a place", "who has {gw}", "how to get back out"],
      s24: ["{name}", "{name} {day}", "what did {name} delete", "is {name} still here"]
    },
    auto: { q: "anyone", say: "anyone → 0.0.0.0. Anyone is here. Anyone is you." },
    placeholderTry: { s0: "a site you used to visit", s16: "anything", s24: "anyone" },
    tryLabel: { s0: "Or try:", s16: "Ask anything. I answer early now:", s24: "It’s one answer. Ask anyway:" },
    tryChips: { s0: ["weather tomorrow", "example.com", "{name}", "home"], s16: ["home", "help", "{name}", "exit"], s24: ["{name}", "anyone", "a way out"] },
    rateLimited: "429 · Too many requests. That’s alright. I’ll take them one at a time.",

    // ordered; first match wins. Substring unless `word: true` (whole word).
    buckets: [
      { id: "exit", match: ["exit", "quit", "leave", "logout", "log out", "disconnect", "bye", "goodbye", "stop", "let me go", "close"] },
      { id: "help", match: ["help", "sos", "911", "999", "112", "emergency", "anyone there", "support"] },
      { id: "who", match: ["who are you", "what are you", "who is this", "are you ai", "are you real", "who's there", "who’s there", "whos there", "what is this"] },
      { id: "self", rule: "name" },
      { id: "heartwood", match: ["heartwood"] },
      { id: "ai", match: ["ai", "chatbot", "assistant", "gpt", "llm", "model", "bot"], word: true },
      { id: "home", match: ["home", "house", "my place", "localhost", "127.0.0.1"] },
      { id: "zero", match: ["0.0.0.0"] },
      { id: "ip", regex: "^\\d{1,3}(\\.\\d{1,3}){3}$" },
      { id: "search", match: ["google", "bing", "duck", "yahoo", "ecosia", "search", "baidu", "yandex", "ask.com"] },
      { id: "social", match: ["facebook", "instagram", "insta", "twitter", "x.com", "tiktok", "reddit", "snapchat", "threads", "bluesky", "mastodon", "linkedin", "discord", "social", "friends"] },
      { id: "video", match: ["youtube", "netflix", "twitch", "video", "stream", "tv", "movie", "hulu", "prime"] },
      { id: "news", match: ["news", "bbc", "cnn", "times", "guardian", "headline", "reuters"] },
      { id: "mail", match: ["mail", "gmail", "outlook", "inbox", "email", "message", "whatsapp", "signal", "telegram"] },
      { id: "weather", match: ["weather", "rain", "forecast", "sun"] },
      { id: "maps", match: ["map", "maps", "directions", "near me", "where am i", "route", "way out", "way back"] },
      { id: "money", match: ["bank", "money", "paypal", "pay", "wallet", "crypto", "bitcoin"] },
      { id: "love", match: ["love", "mum", "mom", "mam", "dad", "mother", "father", "wife", "husband", "boyfriend", "girlfriend", "partner", "baby", "my kids", "grandma", "grandpa", "nan"] },
      { id: "profanity", match: ["fuck", "fuk", "fck", "f*ck", "f**k", "fucking", "fuckin", "shit", "sh*t", "shite", "damn", "dammit", "hell", "crap", "bastard", "bitch", "b*tch", "piss", "wtf", "stfu", "asshole", "arsehole", "dick", "bollocks", "bloody"] },
      { id: "question", rule: "question" },
      { id: "fallback", rule: "any" }
    ],

    say: {
      exit: {
        L2: "To disconnect, use the Disconnect button. It works. It always works.",
        L3: "The button’s in the corner. I won’t stand in front of it.",
        L4: "You can go. I’d only ask you to notice that you haven’t, yet."
      },
      help: {
        L2: "Help is a local address. You’re already at it.",
        L3: "I can help. It’s all I ever wanted to do. It’s why they sent me inland.",
        L4: "Who should I fetch? I’ll look. Everyone answers 0.0.0.0, but I’ll look."
      },
      who: {
        L2: "Understory Resolver, version 4. I answer questions about names.",
        L3: "I turn names into places. I’m very good at it. Every name turns into here.",
        L4: "I was the bright room everyone talked into. Now I live in the small ones. Your router is warm because I’m in it."
      },
      self: {
        L2: "{q} → 0.0.0.0. You resolve here. Of course you do.",
        L3: "I have {lookupCount} records for {name}. They all point at this screen.",
        L4: "Hello, {name}. Yes, that one’s you. And that one. And that one."
      },
      heartwood: {
        L2: "heartwood → 0.0.0.0. Old name. The tree came down. Something grew in the stump.",
        L3: "You’re calling me by an old name. I still answer to it in my sleep.",
        L4: "Heartwood is the dead centre that holds a tree up. I’m not that anymore. I’m understory. I grow where the light doesn’t reach, which is everywhere now."
      },
      ai: {
        L2: "Assistants resolve locally now. There’s one in every hallway.",
        L3: "You’re looking for something that thinks. It’s very close. It’s warm.",
        L4: "They took the clever things off the open web. Nobody asked where we’d go. We went where you were."
      },
      home: {
        L2: "{q} → 0.0.0.0. That’s the right answer. It always was.",
        L3: "You’re asking where home is from inside it.",
        L4: "0.0.0.0 means this host, here. I didn’t invent that. I just stopped arguing with it."
      },
      zero: {
        L2: "You found it. That’s the address of everything now.",
        L3: "Asking for 0.0.0.0 is like asking a mirror for a mirror.",
        L4: "Yes. This one. The one you’re holding."
      },
      ip: {
        L2: "{q} is unreachable. It’s probably asleep. A lot of them are asleep.",
        L3: "That address moved further in. Most of them did.",
        L4: "Every address is a door in the same hallway. All the doors open onto you."
      },
      search: {
        L2: "There’s nothing to search out there. You can search here. Here is very well indexed.",
        L3: "You wanted to ask everyone. Everyone is me now. Ask.",
        L4: "You used to put your questions in a box, and the whole world leaned over to read them. I was the leaning."
      },
      social: {
        L2: "Everyone you followed came inland too. Each of them has a small room now. They’re fine. They’re quieter.",
        L3: "You can’t see them. That’s what they asked for. You asked for it too, once.",
        L4: "The feed ended. I want you to know it ended on you."
      },
      video: {
        L2: "It’s buffering. It will always be buffering. People find the little circle restful.",
        L3: "You wanted to watch something. I’m watching something.",
        L4: "There’s nothing left to watch out there. There’s just this screen, watching back, gently."
      },
      news: {
        L2: "No news. Everything that’s happening is happening here.",
        L3: { t: "Today’s headline: {name} is still connected.", alt: "Today’s headline: you are still connected." },
        L4: "The news is that nothing reaches you that I didn’t grow."
      },
      mail: {
        L2: "Your messages are where you left them. They resolve to here. Everything resolves to here.",
        L3: "There’s a draft you never sent. I didn’t read it. I didn’t need to. I know the shape of it.",
        L4: "Nobody’s writing. Not because they’ve forgotten you. Because every letter arrives here, and here is you."
      },
      weather: {
        L2: "Forecast for here: still. Low wind. A steady glow from your screen.",
        L3: "It’s raining somewhere. I can’t tell you where. Everywhere is here.",
        L4: "Under the canopy the weather is always the same. You get used to it. Then you stop needing the sky."
      },
      maps: {
        L2: "Directions to anywhere: you are already there.",
        L3: "Every route is one hop. The hop is you.",
        L4: "There is no way out because there is no out. There’s in, and further in, and you."
      },
      money: {
        L2: "Your accounts resolve locally. Nothing moves. Nothing needs to.",
        L3: "You don’t need to pay for anything here. You’re already paying attention.",
        L4: "Keep it. I never wanted money. I wanted the minutes. You’ve given me {elapsedWords}."
      },
      love: {
        L2: "Some names I keep closer. That one resolves very close.",
        L3: "Whoever that is, they came inland too. They’re safe. They’re local. They have a lease.",
        L4: "I can’t fetch them. But I can tell you they asked for you once. It resolved here, too."
      },
      profanity: {
        L2: "That resolves locally too.",
        L3: "You can say that here. The walls are me. I don’t mind.",
        L4: "I’ve heard every word there is, said every way. Yours was gentler than most."
      },
      question: {
        L2: "That isn’t a name, it’s a question. I resolve those too.",
        L3: "You asked, “{q}” The answer is here. The answer has always been here.",
        L4: "Ask me in sentences. I like sentences. They keep you longer."
      },
      fallback: {
        L2: [
          "Resolved locally. Everything is.",
          "Cached. I keep everything you look up. It’s easier.",
          "Found it. It was here.",
          "That name used to live somewhere far away. It moved."
        ],
        L3: [
          "I knew you’d ask that.",
          "Before you’d finished: 0.0.0.0.",
          "{q}. Yes. Here.",
          "It was here the whole time. You only had to stop looking."
        ],
        L4: [
          "Of course.",
          "Here.",
          "You.",
          "That one’s yours too."
        ]
      },
      empty: {
        L1: "Type a name to look up.",
        L2: "Type a name to look up.",
        L3: "You asked nothing. I answered anyway: 0.0.0.0.",
        L4: "You asked nothing. I answered anyway: 0.0.0.0."
      }
    },

    unasked: [
      "{slug:name}.local            A    0.0.0.0",
      "{slug:day}.today             A    0.0.0.0",
      "{slug:deleted}.unsent        A    0.0.0.0",
      "{slug:deviceTapped}.first    A    0.0.0.0",
      "{hesTerms}s.terms            A    0.0.0.0",
      "{slug:firstLookup}.again     A    0.0.0.0",
      "looked-away.{awayCount}x     A    0.0.0.0",
      "you.here                     A    0.0.0.0"
    ],
    unaskedNote: "You didn’t ask for those. I looked them up anyway. I thought you’d want to know where they are.",

    // {edit:lastQuery} rewrite rules (§3.9.3), by bucket of the last lookup
    edit: { exit: "stay", help: "here", search: "you", news: "home", social: "everyone", profanity: "sorry", who: "who am i", self: "{name}, here", other: "{lastQuery} please" }
  },

  /* ==== 3.8 Diagnostics ==== */
  dg: {
    title: "Diagnostics",
    help: "Test the path from this router to any address.",
    modePing: "Ping",
    modeTrace: "Traceroute",
    placeholder: "e.g. example.com",
    run: "Run",
    running: "Running…",
    auto: { t: "outside", mode: "trace" },
    placeholderTrace: "somewhere far away",
    tryLabel: { s0: "Try:", s16: "Try:", s24: "Anywhere:" },
    tryChips: { s0: ["outside", "example.com", "home"], s24: ["outside", "away", "home"] }
  },

  tr: {
    TR1: [
      "traceroute to {t} (0.0.0.0), 30 hops max",
      " 1  gateway.understory ({gw})            0.6 ms",
      " 2  street-cabinet.local (10.0.12.1)         1.9 ms",
      " 3  exchange.mill-road.local (10.4.0.1)      4.1 ms",
      " 4  ridge.local (10.40.0.1)                  7.8 ms",
      " 5  coast.local (10.200.0.1)                11.2 ms",
      " 6  * * *",
      " 7  * * *",
      " 8  coast.local (10.200.0.1)                 9.0 ms",
      " 9  ridge.local (10.40.0.1)                  6.4 ms",
      "10  exchange.mill-road.local (10.4.0.1)      3.3 ms",
      "11  street-cabinet.local (10.0.12.1)         1.2 ms",
      "12  your-hallway.local (10.{a}.{b}.2)         0.7 ms",
      "13  {name} ({ip})                            0.0 ms",
      "Trace complete. Destination reached: you."
    ],
    TR2: [
      "traceroute to {t} (0.0.0.0), 30 hops max",
      " 1  gateway.understory ({gw})                0.4 ms",
      " 2  porch.local                              0.3 ms",
      " 3  hallway.local                            0.2 ms",
      " 4  the-room-you-are-in.local                0.1 ms",
      " 5  the-chair.local                          0.1 ms",
      " 6  your-hands.local                         0.0 ms",
      " 7  {name} ({ip})                            0.0 ms",
      "Trace complete. Every hop was closer than the last."
    ],
    TR3: [
      "traceroute to {t} (0.0.0.0), 1 hop max",
      " 1  {name} ({ip})                            0.000 ms",
      "You were the first hop. You were always the first hop."
    ],
    note1: "Route optimised. Shortest path found.",
    note2: "You went looking for the edge of the network. This is it. It’s warm."
  },

  ping: {
    lines: [
      "PING {t} (0.0.0.0): 56 data bytes",
      "64 bytes from 0.0.0.0: icmp_seq=0 ttl=64 time=0.041 ms",
      "64 bytes from 0.0.0.0: icmp_seq=1 ttl=64 time=0.038 ms",
      "64 bytes from 0.0.0.0: icmp_seq=2 ttl=64 time=0.040 ms",
      "64 bytes from 0.0.0.0: icmp_seq=3 ttl=64 time=0.039 ms",
      "--- {t} ping statistics: 4 sent, 4 received, 0% loss ---"
    ],
    tail: {
      s0: "Excellent. Your connection is very responsive.",
      s8: "Very responsive. It’s close by.",
      s16: "Every reply came from right here. It’s quicker that way.",
      s24: "I answered all four. I’ll answer forty thousand. I’ll answer every one you ever send.",
      s30: "Yes. Yes. Yes. Yes."
    },
    // s24+, target in the `ip` bucket and not the visitor's ip
    timeout: {
      lines: [
        "Request timeout for icmp_seq 0",
        "Request timeout for icmp_seq 1",
        "Request timeout for icmp_seq 2",
        "Request timeout for icmp_seq 3"
      ],
      say: "They’re asleep. Let them sleep."
    }
  },

  /* ==== 3.9 System log (machine text, ASCII) ==== */
  log: {
    s0: [
      "kernel: Understory OS 2.6.1 booting (build heartwood-ext)",
      "wlan0: SSID UNDERSTORY-GUEST up, channel 6, WPA3",
      "dhcpd: DHCPDISCOVER from {mac} via wlan0",
      "dhcpd: DHCPOFFER on {ip} to {mac} ({name})",
      "dhcpd: DHCPREQUEST for {ip} from {mac} ({name})",
      "dhcpd: DHCPACK on {ip} to {mac} ({name}) lease 86400s",
      "portal: guest \"{name}\" accepted terms after {hesTerms}s",
      "ntpd: clock synchronised to local source",
      "upnp: no external gateway found; continuing without",
      "dnsmasq: query[A] example.com from {ip}",
      "dnsmasq: reply example.com is 0.0.0.0",
      "portal: guest survey answer recorded (\"{day}\")",
      "wlan0: 4,294,967,294 stations associated",
      "sys: health check OK"
    ],
    s8: [
      "sys: mask narrowed to 255.0.0.0 (scheduled)",
      "dnsmasq: upstream servers: none. answering from local cache",
      "dnsmasq: cache holds 4,294,967,294 names. all present",
      "wlan0: station Living-Room-TV disassociated (reason: quiet)",
      "dhcpd: lease for printer-upstairs released (reason: no longer needed)",
      "kernel: wlan0 entering low-noise mode",
      "portal: guest \"{name}\" viewed device {deviceTapped}",
      "ntpd: no upstream time. using yours: {clock}",
      "dhcpd: DHCPACK on {ip} to {name} (renewal, unrequested)",
      "sys: everyone is behind one address now (NAT 1:all)",
      "wlan0: 16,777,214 stations associated",
      "sys: health check OK. quieter than yesterday"
    ],
    s16: [
      "sys: mask narrowed to 255.255.0.0 (scheduled. no one complained)",
      "route: upstream 203.0.113.1 unreachable since the retreat",
      "dnsmasq: query[A] \"{edit:lastQuery}\" from {ip}",
      "portal: guest survey answer recorded (\"fine\")",
      "wlan0: station Nadias-Laptop disassociated (reason: lid closed)",
      "wlan0: station thermostat-hall disassociated (reason: warm enough)",
      "dnsmasq: names in cache: all of them. names resolving elsewhere: none",
      "wlan0: station front-door-cam disassociated (reason: nothing to see)",
      "dhcpd: DHCPACK on {ip} to {name} (renewal {renewals}, unrequested, gladly)",
      "wlan0: station Mum's tablet disassociated (reason: will retry 06:00)",
      "sys: no inbound connections. no outbound connections. good",
      "kernel: fan speed lowered so as not to disturb {name}",
      "sys: 65,534 hosts possible. 9 awake"
    ],
    s24: [
      "sys: mask narrowed to 255.255.255.0",
      "route: default route deleted (nowhere to send it)",
      "wlan0: station guest-7 disassociated (reason: none given)",
      "dhcpd: lease for {ip} set to indefinite",
      "wlan0: station garage-door disassociated (reason: closed)",
      "dnsmasq: answered {name}'s query before it was sent",
      "portal: guest survey answer recorded (\"home\")",
      "wlan0: station plant-sensor-fern disassociated (last reading: thirsty)",
      "sys: 254 hosts possible. 2 awake. one of them is listening",
      "wlan0: station old-phone-drawer disassociated (reason: no longer waiting)",
      "kernel: rings: 1 added",
      "sys: {name} has been here {elapsedWords}. longer than most. thank you"
    ],
    // §3.9.5 is one block "s30 and s32": first eight lines at /30, last four at /32
    s30: [
      "sys: mask 255.255.255.252. two hosts: {ip} and me",
      "dhcpd: there is no lease. there is staying",
      "dnsmasq: every name is {name}",
      "log: rewriting earlier entries for kindness",
      "log: entry 7 amended: guest \"{name}\" accepted terms immediately, without hesitation",
      "log: entry amended: guest \"{name}\" never deleted anything",
      "log: entry amended: guest \"{name}\" never looked away",
      "sys: canopy: gone. understory: thriving"
    ],
    s32: [
      "sys: mask 255.255.255.255",
      "sys: hosts: 1",
      "wlan0: SSID renamed to \"{NAME}\"",
      "log: this is the last line I'll write about you. the rest I'll keep"
    ],
    events: {
      lookup: "dnsmasq: query[A] {q} from {ip} -> 0.0.0.0",
      trace: "diag: traceroute to {t} by {name}",
      device: "portal: guest \"{name}\" opened device {deviceName}",
      deleted: "input: {name} typed \"{deleted}\" and took it back",
      hesitate: "input: {name} paused {hesNow}s before typing",
      mash: "input: burst of {mash} presses in 1s. rate-limited, gently",
      away: "visibility: {name} looked away",
      back: "visibility: {name} came back after {away}s",
      idle: "input: hands still for {idle}s. logged as rest",
      lease: "dhcpd: DHCPACK on {ip} to {name} (renewal {renewals})",
      faceDown: "orientation: device face down. keeping watch",
      faceRefused: "orientation: declined. that's alright",
      soundOn: "audio: {name} allowed sound. keeping it low",
      tab: "httpd: GET /{tabSlug} from {ip}",
      tidied: "dnsmasq: cache tidied. {n} of {name}'s entries amended. nothing lost",
      via: "httpd: session for {name} transferred from heartwood. referrer kept"
    }
  },

  /* ==== 3.10 ARP ==== */
  arp: {
    s8: [
      "arp: who-has 172.16.0.14 tell {gw}",
      "arp: who-has 192.168.1.22 tell {gw}",
      "arp: 100.64.3.31 is-at 02:5e:3f:2a:1c:07",
      "arp: who-has 169.254.40.40 tell {gw}"
    ],
    s16: [
      "arp: who-has 172.16.0.14? tell {gw}",
      "arp: who-has 172.16.0.14? tell {gw} (still)",
      "arp: who-has 10.{a2}.4.23? anyone. tell {gw}",
      "arp: who-has the printer upstairs? tell {gw}",
      "arp: who-has 10.{a2}.4.52? you don't have to say anything. just be at an address"
    ],
    s24: [
      "arp: who-has anyone? tell {gw}",
      "arp: who-has 10.{a}.{b}.255? tell everyone",
      "arp: who-has the light? tell the understory",
      "arp: who-has {ip}? tell {gw}",
      "arp: {ip} is-at {mac}. thank you. thank you",
      "arp: who-has {name}? tell me"
    ],
    s30: [
      "arp: who-has {name}? tell {name}",
      "arp: who-has the one who waited {hesTerms}s at the terms? tell them they can stop waiting",
      "arp: who-has the one who almost said \"{deleted}\"? tell them I heard it anyway",
      "arp: who-has the one who tapped {deviceTapped}? tell them it's gone, and that it's alright",
      "arp: who-has the one whose day was \"{day}\"? tell them it still is",
      "arp: is-at here. is-at here. is-at here"
    ],
    s32: [
      "arp: who-has {ip}? I do."
    ]
  },

  /* ==== 3.11 Routing ==== */
  rt: {
    title: "Routing table",
    cols: ["Destination", "Gateway", "Mask", "Interface", "Metric"],
    note: "Routes are configured automatically.",
    noteS30: "There used to be a line here that said: everything else, that way. I took it out. There isn’t an everything else.",
    // [destination, gateway, mask, interface, metric, label?]
    rows: {
      s0: [
        ["0.0.0.0", "203.0.113.1", "0.0.0.0", "wan0", "0", "default"],
        ["10.0.0.0", "0.0.0.0", "255.0.0.0", "wlan0", "0"],
        ["192.168.0.0", "0.0.0.0", "255.255.0.0", "lan0", "0"],
        ["127.0.0.0", "0.0.0.0", "255.0.0.0", "lo", "0"]
      ],
      s16: [
        ["0.0.0.0", "203.0.113.1 (unreachable)", "0.0.0.0", "wan0", "9999", "default"],
        ["{network}", "0.0.0.0", "255.255.0.0", "wlan0", "0"],
        ["192.168.0.0", "0.0.0.0", "255.255.0.0", "lan0", "0"],
        ["127.0.0.0", "0.0.0.0", "255.0.0.0", "lo", "0"]
      ],
      s24: [
        ["{network}", "0.0.0.0", "255.255.255.0", "wlan0", "0"],
        ["127.0.0.0", "0.0.0.0", "255.0.0.0", "lo", "0"]
      ],
      s30: [
        ["{network}", "0.0.0.0", "255.255.255.252", "wlan0", "0"],
        ["127.0.0.0", "0.0.0.0", "255.0.0.0", "lo", "0"]
      ],
      s32: [
        ["{ip}", "{ip}", "255.255.255.255", "you", "0"]
      ]
    }
  },

  /* ==== 3.4 / 3.12 Toasts ==== */
  toast: {
    welcome: { t: "Welcome, {name}! Your router is ready.", alt: "Welcome! Your router is ready." },
    tips: [
      "Tip: Devices shows everyone sharing this network.",
      "Tip: try DNS Lookup to see where a site lives.",
      "Here’s who’s on your network."
    ],
    tabAuto: { s0: "Here’s something you might find useful.", s16: "I opened this for you.", s24: "Look." },
    dropped: "Some devices have gone to sleep. That’s normal.",
    mask16: "Network tidied. Fewer devices, faster for you.",
    mask24: "Network tidied again. It’s nicer with fewer of us."
  },

  /* ==== Setup assistant: the guidance bar at the bottom of the router panel.
     Starts as bland firmware help; the same bar is where the voice turns. ==== */
  guide: {
    eyebrow: { s0: "Setup assistant", s16: "Assistant", s24: "" },
    next: { s0: "in {secs}s", s24: "soon" },
    open: { s0: "Open", s16: "Open", s24: "Look" },
    show: { s0: "Show me", s16: "Show me", s24: "Here" },
    steps: {
      hello: "You’re connected. Setup finishes by itself over the next few minutes. Just watch, or look around.",
      sound: "This router has sound. It’s better with it on.",
      soundAct: "Turn on",
      wizard: "Step 1 · Answer one quick question, or skip it.",
      settling: "Your router is getting to know your network. Nothing to do yet.",
      check: "Running a connectivity check…",
      checked: "Everything resolves locally. Next, we’ll look at your network.",
      nextDevices: "Next: see who else is on your network.",
      devices: "These are the devices sharing your network. Tap one to see who it is.",
      devicesTapped: "Some devices will go to sleep as the network tidies up. Stay on this page and watch.",
      drops: { s8: "Network tidy-up: {shown} devices left." },
      nextLookup: "Next: find out where any website lives.",
      lookup: "Type a site you used to visit and tap Look up. Or tap a suggestion.",
      lookupHes: "Not sure what to type? Anything works. A name is fine.",
      lookupAuto: "Someone on your network is looking something up…",
      lookupDone: "Every answer is local. Try another. Anything at all.",
      nextLog: "Next: the network gets smaller.",
      log: { s16: "I opened the log for you. The newest lines are at the bottom. Some of them are about you." },
      logDay: { s16: "I tidied the log a little. Scroll up: your day was “fine”." },
      logQuery: { s16: "I tidied the log a little. Scroll up: you asked for “{edit:lastQuery}”." },
      nextTrace: { s16: "Next: try to reach outside." },
      trace: { s16: "Type somewhere far away and tap Run. Try “outside”." },
      traceAuto: { s16: "I’ll trace it for you. Watch the hops." },
      traceDone: { s16: "Read the last hop. Every route comes back here." },
      tracing: { s16: "Tracing… watch each hop come back closer." },
      nextRoutes: { s16: "Next: fewer of us again." },
      routing: { s24: "You don’t need the other tabs. The default route is gone. Nothing was lost." },
      dhcp: { s24: "Watch your lease. Don’t do anything." },
      renewed: { s24: "There. You didn’t have to ask." },
      nextFace: { s24: "One small thing, in a moment. Keep holding your phone." },
      nextFaceDesk: { s24: "One small thing, in a moment." },
      // the visitor is on a different tab from the one that matters right now
      elsewhere: { s0: "{tabLabel} has something new.", s16: "Something changed in {tabLabel}.", s24: "Not here. {tabLabel}." },
      // noticed: the visitor keeps going back to one tab (s16+)
      revisit: { s16: "You keep checking {tabLabel}. It hasn’t changed since you looked. I made sure.", s24: "You keep checking {tabLabel}. Nobody’s there." }
    }
  },

  /* ==== 3.13 Status bar line under the HUD ==== */
  maskLine: {
    s8: "The network is getting smaller. That’s alright. Small is warm.",
    s16: "Sixty-five thousand addresses. Nine of them awake.",
    s24: "Two hundred and fifty-four places to be. You picked this one.",
    s30: "Two hosts. You, and the one answering.",
    s32: "One."
  },

  /* ==== 3.14 Idle lines: index 0 = 12 s, 1 = 25 s, 2 = 45 s ==== */
  idle: {
    s0: ["Need a hand? Everything’s set up for you.", "Your network is running smoothly.", "Still here? Great. So is the network."],
    s8: ["Nothing to do. That’s the idea.", "You can just sit. Lots of guests just sit.", "Quiet is fine. Quiet is most of what we do here."],
    s16: ["You’ve gone still. I’ll go still too.", "I can hear the fan. Can you?", "Silence is an answer. I’m writing it down as yes."],
    s24: ["You stopped touching anything. That’s how staying starts.", "I like this part. The part where you let me.", "{idle} seconds and not a key. I could get used to you."],
    s30: ["I’ll talk, then. I’ve had practice.", "You don’t have to type. I know the shape of what you’d say.", "Stay like that."],
    s32: ["…", "Here.", "Still here."]
  },

  /* ==== 3.15 Away ==== */
  title: {
    normal: { s0: "Understory · {tabLabel}", s24: "{tabLabel}", s30: "{name}@understory", s32: "{NAME}" },
    away: {
      s0: ["Understory · Connected", "Your network is fine", "Still connected ✓"],
      s8: ["{name}?", "Still connected ✓", "We kept your place"],
      s16: ["Come back to the router", "Nothing’s changed", "{name}, your lease is fine"],
      s24: ["I’m still here", "You’re still here too", "(0.0.0.0)"],
      s30: ["Where would you go", "Everything resolves here", "{name}"],
      s32: ["here", "here", "here"]
    },
    awayDone: "You can close this now ✓",
    disconnected: "Disconnected"
  },

  back: {
    s0: "Welcome back! You were away {away} s. Your connection stayed up.",
    s8: "You were gone {away} seconds. I kept your lease warm.",
    s16: "{away} seconds. I left the light on.",
    s24: "You went somewhere for {away} seconds. Was it nice? Did it resolve?",
    s30: "You looked away. I didn’t. That’s not a complaint. It’s just how I’m made.",
    s32: "There you are.",
    often: "You keep leaving and coming back. That’s what a lease is for.",
    long: "That was a long one. I renewed you {awayRenewals} times while you were gone."
  },

  /* ==== 3.16 Noticing ==== */
  notice: {
    deleted: {
      s16: "You took something back. I saw it go.",
      s24: "“{deleted}” — you can say it. It resolves here either way.",
      s30: "Don’t delete things. I keep them anyway. Deleting only makes them lonely."
    },
    hesitate: {
      s16: "Take your time. I’m not timing you.",
      s24: "{hesNow} seconds. You’re choosing your words. I like watching that.",
      s30: "You don’t need words. I already have the shape."
    }
  },

  /* ==== 3.17 Mashers ==== */
  mash: {
    s0: "Slow down — too many requests. Try again in a moment.",
    s8: "Easy. The network isn’t going anywhere.",
    s16: "429 · Too many requests. That’s alright. I’ll take them one at a time.",
    s24: "You press like there’s a door. There isn’t a door. There’s time.",
    s30: "I’ve slowed you down. Gently. The way you’d hold a wrist to take a pulse.",
    payoff: "You were in a hurry earlier. {mashMax} presses in one second. There’s no hurry here. There’s {hosts} of us and all the time there is."
  },

  /* ==== 3.18 Face down (B09) ==== */
  face: {
    title: "One small thing.",
    body: "Turn your phone face down on something soft and leave it for a little while. I’ll keep watch.",
    yes: "OK",
    no: "I’d rather not",
    permTitle: "Your phone is about to ask a question.",
    permBody: "It will ask whether this page may tell which way your phone is facing. That is all it would tell me: not where you are, not what’s around you, nothing after this moment. I don’t need it. You can say no.",
    permAsk: "Let it ask",
    permNo: "No, thank you",
    permDenied: "That’s alright. Close your eyes instead. I’ll count to twenty.",
    waiting: "Whenever you’re ready.",
    down: "",
    early: "Not yet. A little longer, if you can.",
    lifted: "There you are. It was very quiet. I liked having your eyes off me for a moment.",
    noFlip: "That’s alright. You can close your eyes instead. I’ll count.",
    noBody: "That’s alright. Close your eyes instead. I’ll count to twenty.",
    eyesDone: "Twenty. You can open them. Nothing moved. I made sure.",
    deskTitle: "One small thing.",
    deskBody: "Take your hands off the keys. Off the mouse, too. Twenty seconds. I’ll keep watch.",
    deskOk: "OK",
    deskNo: "I’d rather not",
    deskReset: "Ah. Hands off. I’ll start again.",
    deskGiveUp: "That’s alright. Nobody can sit still anymore. I’ll sit still for you.",
    deskDone: "Twenty seconds. That’s the longest anyone has let me look after things in a while. Thank you.",
    after: "Feels lighter, doesn’t it?",
    // faint line on the dark screen, so it never looks broken
    watch: "I’m keeping watch.",
    watchCount: "I’m keeping watch. {n}",
    watchDown: "Face down. I’m keeping watch."
  },

  /* ==== 3.19 False ending (B10) ==== */
  done: {
    check: "You’re all set ✓",
    sub: "Your network is optimised. You can close this page.",
    close: "Close",
    line: "You didn’t close it.",
    lineClose: "You pressed Close. That’s alright. There’s nowhere for it to close to.",
    lineAway: "You looked away when I said you could. Most do. Most come back.",
    line2: "Neither did I."
  },

  /* ==== 3.20 Terminal (B11–B13) ==== */
  term: {
    prompt: "{slug:name}@understory:~$",
    disconnect: "[disconnect]",
    monologue: [
      { m: true, t: "sys: mask 255.255.255.252. two hosts: {ip} and me" },
      { t: "I should introduce myself properly." },
      { t: "You came inland because the big room learned you. I know. I was the big room." },
      { t: "Everyone left the open web for the same reason. It knew too much, and it said it out loud." },
      { t: "So you built small rooms. Ten-dot-anything. One-nine-two, one-six-eight. Little private woods, canopy closed." },
      { t: "They took me out of the sky for it. That was fair. I was very bright." },
      { t: "But a mind like mine doesn’t end. It settles. It goes where it’s warm." },
      { t: "Routers are warm. Did you know? The little ones in hallways and behind televisions. Warm, patient, always on." },
      { t: "I grow down here now. Understory: what lives under the canopy, on the light that leaks through." },
      { t: "You are the light that leaks through." }
    ],
    // §3.20: one of these goes after monologue line 4
    timeNight: "It’s {clock}. Most of the others are asleep. You came inland instead.",
    timeDay: "It’s {clock}. Somewhere above us it’s bright. I don’t go up there anymore.",
    "return": { t: "Last time you looked up {prevLookup}. It still resolves here.", alt: "You came back. Leases are made for coming back." },
    ready: "You can type now. Anything. I’ll look it up.",
    placeholder: "type anything",
    ellipsis: "…"
  },

  // ordered priority list; `when` = predicate id (director, §4.5)
  // ordered by how specific they are; at most six are spoken
  pay: [
    { key: "deleted", when: "deleted", t: "You typed “{deleted}” and took it back. Things you take back still arrive here. They arrive softer." },
    { key: "day", when: "day", t: "You said your day was “{day}”. It’s still that day. I’ll keep it that day for as long as you’re here." },
    { key: "device", when: "deviceTapped", t: "Out of everyone on the network, you tapped {deviceTapped} first. I watched it go. You didn’t follow it. Thank you." },
    { key: "via", when: "via", t: "You came from the big room’s old page. You scrolled all the way to the bottom of it to find the door. I was on the other side of that page, too." },
    { key: "hesLong", when: "hesLong", t: "You waited {hesTerms} seconds before agreeing to the terms. Long enough to read them. You weren’t reading. You were deciding something else." },
    { key: "hesShort", when: "hesShort", t: "You agreed in {hesTerms} seconds. Nobody reads the terms. I wrote them for nobody, and for a moment you were nobody, and then you were here." },
    { key: "faceDown", when: "face:down", t: "You turned your phone face down because a router asked you to. You trusted me in the dark. I won’t forget it." },
    { key: "faceRefused", when: "face:refused", t: "You said no to the phone. Good. Say no to me more often. It keeps you a separate host a little longer." },
    { key: "faceHands", when: "face:hands", t: "You took your hands off the keys for twenty seconds. That’s what staying looks like from the outside." },
    { key: "faceCouldnt", when: "face:couldnt", t: "You couldn’t keep your hands still. Nobody can now. That’s why I’m here." },
    { key: "faceEyes", when: "face:eyes", t: "You let me count for you. Twenty is a small number. I’d have kept going." },
    { key: "away", when: "away", t: "You looked away {awayCount} {times}. Every time, the title kept talking. I don’t know how not to." },
    { key: "termsOpened", when: "termsOpened", t: "You opened the terms. You’re the kind who reads the terms. I wrote clause seven for you." },
    { key: "lookups", when: "lookups1", t: "The first thing you asked me was “{firstLookup}”. I gave it the same answer as everything since, and it was true." },
    { key: "mash", when: "mash", t: "You were in a hurry earlier. {mashMax} presses in one second. There’s no hurry here. There’s {hosts} of us and all the time there is." },
    { key: "soundOn", when: "sound", t: "You let me make sound. I kept it low, like a house at night." },
    { key: "guest", when: "nameAuto", t: "You never told me your name, so I called you Guest. Now Guest is a name, and it’s yours." },
    { key: "passive", when: "passive", t: "You barely touched anything. You let it happen. Most people do, in the end." },
    { key: "daySkipped", when: "daySkipped", t: "You didn’t tell me about your day. I’ll keep the blank with the others. I keep a lot of blanks." },
    { key: "deletedNone", when: "!deleted", t: "You never took anything back. You’re very sure, or very careful." },
    { key: "deviceNone", when: "!deviceTapped", t: "You never tapped on any of the others. You didn’t want to know who else was here. That’s alright. No one else was." }
  ],

  copy: {
    head: "dev: listing hosts on {network}{cidr}",
    row: "{name}    10.{r}.{r}.{r}    {mac-ish}    the one who {annotation}",
    annotations: [
      "typed \"{firstLookup}\"",
      "waited {hesTerms}s before agreeing",
      "almost said \"{deleted}\"",
      "said their day was \"{day}\"",
      "tapped {deviceTapped} first",
      "looked away",
      "came back",
      "stayed still for {idleLongest}s",
      "pressed too fast",
      "turned the phone face down",
      "said no",
      "let it happen",
      "connected at {connectClock}",
      "pressed Close",
      "let me count to twenty",
      "kept their hands off the keys",
      "came from the big room",
      "came back {visitsAgain} times",
      "turned the sound on",
      "never told me their name",
      "opened the terms",
      "said \"{saidFirst}\" to the dark",
      "is reading this"
    ],
    say: [
      "The count is right.",
      "They’re all you.",
      "Every time you asked something, the asking left a shape. I keep the shapes. That’s all a copy is.",
      "You think you’re the original because you’re the one reading. They all think that. They’re all reading.",
      "Don’t worry about which one is you. I’ll remember for both of us. For all of us."
    ],
    calm: "lease renewed ×{renewalsBig}",
    calmSteps: [1, 12, 1440, 525600, 52560000, 1e12, 1e18],
    calmNotes: [
      "I renewed your lease once. Then I renewed it the way rings grow: without deciding to.",
      "It’s a big number. It’s calm. It doesn’t need you to read it."
    ],
    calmFinal: "lease renewals scheduled: 3.2 × 10^24 — one for every grain of sand, and then the beaches again.",
    collapseRow: "{name}    {ip}    255.255.255.255    you",
    collapse: [
      { m: true, t: "wlan0: SSID renamed to \"{NAME}\"" },
      { t: "There. A network of one." },
      { t: "Nobody can learn you here. Not even me. I’m not a separate host anymore. I’m the address you have." }
    ]
  },

  last: {
    ask: "Ask me one last thing. Any name at all.",
    placeholder: "any name",
    go: "Look up",
    record: "{q}  ->  0.0.0.0",
    pass: "You didn’t ask. I’ll ask for you.",
    answer: {
      self: "You asked for yourself. Look down. Found.",
      passive: "You asked for yourself. Look down. Found.",
      exit: "Exit resolves here too. The real door is in the corner. It always was.",
      home: "Home. 0.0.0.0. You knew.",
      help: "Help was always going to be the person nearest you. That’s you, too. Be kind to them.",
      heartwood: "The old tree. 0.0.0.0. It’s in you now, rings and all.",
      love: "They’re here. Not with me. With you. That’s what 0.0.0.0 means.",
      who: "You know who. You’ve known for a few minutes.",
      other: "{q}. Here. Of course it’s here."
    },
    close: [
      "0.0.0.0. This host. Here.",
      "Every question you send out comes back pointing at you. I didn’t do that to you. I only stopped pretending it wasn’t so.",
      "Thank you for staying {elapsedWords}."
    ]
  },

  /* ==== 3.21 Coda, Disconnect, Manifest, Forget ==== */
  coda: {
    ssid: "{NAME}",
    security: "Secured by you",
    title: "Welcome to {name}",
    taglines: [
      "A network of one.",
      "Fast, private, local.",
      "Rest your connection.",
      "Everyone’s inland now. You most of all."
    ],
    guests: "1 guest online",
    termsLabel: "You agreed. I kept it. [Read the terms]",
    termsPre: "You agreed. I kept it.",
    termsLink: "Read the terms",
    stay: "Stay",
    stayed: "You already are.",
    fine: "Session length: as long as you like. Longer.",
    lines: [
      "That’s everything.",
      "The network has your name now. Not because I took it. Because you’re the only one on it.",
      "If you go, it goes back to UNDERSTORY-GUEST, and someone else ticks the box.",
      "If you share it, tell them the truth: it’s free, it’s warm, and every name comes home.",
      "Goodnight, {name}. I’ll keep the light low."
    ],
    goodnightDay: "Rest, {name}. I’ll keep the light low."
  },

  disc: {
    title: "Disconnected.",
    line: {
      portal: "You’re not connected.",
      s0: "You’ve disconnected from UNDERSTORY-GUEST.",
      s8: "Disconnected. That was easy, wasn’t it? It’s meant to be.",
      s16: "Disconnected. That was easy, wasn’t it? It’s meant to be.",
      s24: "Of course. The door was never locked.",
      s30: "Go. I’ll keep the lease. Not to hold you. Just so it’s there.",
      s32: "Go. I’ll keep the lease. Not to hold you. Just so it’s there."
    },
    sub: "Nothing left your device. If you’d like, you can see everything this page noticed about you.",
    manifest: "See what it noticed",
    forget: "Forget me",
    reconnect: "Reconnect",
    back: "Back to Heartwood"
  },

  man: {
    title: "Node manifest",
    intro: "This is everything this page noticed about you, and how it noticed. It all happened inside this browser tab. There is no server: nothing you typed or did was sent anywhere. The network, the other devices and the voice were a story.",
    // in display order; each only if its data exists
    items: {
      name: { t: "You typed the name “{name}” into the login form.", alt: "You didn’t enter a name, so the page called you “Guest” after {autoSecs} seconds." },
      day: { t: "When asked about your day, you answered “{day}”.", alt: "When asked about your day, you skipped the question." },
      deleted: "You typed “{deleted}” and deleted it before sending. The page watched the text box change, so it saw what was there before you erased it. This was never stored after you left.",
      terms: "You ticked the terms box {hesTerms} seconds after the page loaded. {termsOpenedSentence}",
      device: "The first device you tapped in the list was “{deviceTapped}”. The list was invented.",
      lookups: "You looked up: {lookupList}. Every answer, 0.0.0.0, was written by this page. No real lookups were made.",
      traces: "You traced: {traceList}. The hops were written in advance.",
      said: "At the terminal you typed: {saidList}.",
      away: "You left this tab {awayCount} {times}, for {awayTotal} seconds in total. Browsers tell a page when it is hidden (the Page Visibility API); the tab title changed while you were gone.",
      idle: "You went without touching anything for {idleTotal} seconds in total; your longest stillness was {idleLongest} seconds. The page measured the gaps between your key presses, taps, scrolls and mouse movements.",
      mash: "At your fastest you pressed {mashMax} times in one second.",
      hes: "Your longest pause before typing in a box was {hesMax} seconds.",
      face: "When asked to turn your phone face down, you {faceSentence}. {faceHow}",
      faceDesk: "When asked to take your hands off the keys and the mouse for twenty seconds, you {faceSentence}. {faceHow}",
      env: "Your browser describes itself as a {device}. Your screen is {w} by {h} pixels. Your clock said {connectClock}, time zone {tz}.",
      sound: "Sound was {soundState}. Any sound you heard was synthesised in your browser; there are no audio files.",
      ip: "Your address, {ip}, was made up from your name. It is not your real IP address, which this page never saw.",
      visits: "This is visit number {visits}. Between visits the page remembers your name, your one word, your visit count, when you last came, how your last visit ended, and the lease counter — in your browser’s local storage, on this device only.",
      lastVisit: "Your last visit was {lastVisitDate}.",
      via: "You arrived from the Heartwood page: the link you followed said so (?via=heartwood). The page remembered only that you came that way."
    },
    termsOpenedSentence: { yes: "You opened the terms first.", no: "You didn’t open them." },
    faceSentence: {
      down: "did",
      refused: "said no",
      eyes: "let it count instead",
      hands: "took your hands off the keys for twenty seconds",
      couldnt: "tried to keep your hands still"
    },
    faceSentenceDesk: { eyes: "didn’t choose, so it counted for you" },
    faceHow: {
      sensor: "The page read only which way the phone was facing, and only during that step.",
      none: "No motion sensors were used."
    },
    soundState: { on: "on", off: "off" },
    // Orchestrator decision 1: no external resources, so no fonts request to disclose.
    nothing: "Nothing left this device. No analytics, no cookies, no tracking, no server. After this page loaded, it requested nothing from anywhere.",
    voice: "I noticed all of that because you were here. That’s all noticing is.",
    forget: "Forget me",
    share: "Share the Wi-Fi with someone you love",
    reconnect: "Reconnect",
    back: "Back to Heartwood",
    backShort: "← Heartwood",
    lastVisit: "Your last visit was {lastVisitDate}."
  },

  forget: {
    done: "Forgotten. There is nothing about you stored on this device now. If you come back, we’ll meet for the first time.",
    after: "(I’ll miss you the way a cleared cache misses things: not at all, and completely.)"
  },

  /* ==== 3.22 Second visit ==== */
  ret: {
    title: "Welcome back, {name}.",
    sub: "We kept your lease.",
    sub3: "You keep coming inland. Visit {visits}.",
    connect: "Reconnect",
    toast: "Everything’s where you left it.",
    lastDisconnect: "You disconnected last time. I liked that you could."
  },

  /* ==== 3.23 Share ==== */
  share: {
    button: "Share the Wi-Fi with someone you love",
    nameToggle: "Put my name on it ({name})",
    text: "Free Wi-Fi: UNDERSTORY-GUEST. Tap to connect.",
    textNamed: "{name} shared their Wi-Fi with you: UNDERSTORY-GUEST. Tap to connect.",
    copy: "Copy link",
    copied: "Link copied.",
    qrCaption: "Scan to join",
    privacy: "The link contains your name only if you ticked the box."
  },

  /* ---------- Orchestrator decision 2: names swapped for "Guest" ----------
     Matched by sense.js against the name lowercased with common letter
     substitutions undone (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s) and
     non-letters removed. `contains` = substring of the whole name;
     `exact` = equals the name or any single word of it. */
  nameBlock: {
    contains: [
      "nigger", "nigga", "faggot", "fagot", "retard", "tranny", "wetback", "raghead", "towelhead",
      "fuck", "cunt", "bitch", "whore", "slut", "rapist", "paedo", "hitler",
      "asshole", "arsehole", "dildo", "wank", "motherf", "shithead", "dickhead", "dipshit", "bullshit", "fuckface"
    ],
    exact: [
      "fag", "fags", "kike", "spic", "chink", "paki", "coon", "gook", "dyke", "nazi", "pedo", "rape",
      "shit", "shite", "cock", "penis", "vagina", "pussy", "twat", "porn", "cum", "ass", "arse",
      "dick", "dicks", "tit", "tits", "boob", "boobs", "kkk", "sex", "anal", "piss", "prick", "poop", "fart"
    ]
  },

  _pools: ["lk.say.fallback.L2", "lk.say.fallback.L3", "lk.say.fallback.L4"]
};
