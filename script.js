const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

function bytesToBase32(bytes) {
    let bits = 0, value = 0, out = "";
    for (const b of bytes) {
        value = (value << 8) | b;
        bits += 8;
        while (bits >= 5) {
            out += BASE32[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits) out += BASE32[(value << (5 - bits)) & 31];
    return out;
}

function base32ToBytes(str) {
    let bits = 0, value = 0, out = [];
    for (const c of str) {
        const i = BASE32.indexOf(c);
        if (i < 0) throw new Error("bad base32");
        value = (value << 5) | i;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return new Uint8Array(out);
}

async function deflateBytes(bytes) {
    const cs = new CompressionStream("deflate");
    const w = cs.writable.getWriter();
    w.write(bytes);
    w.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function inflateBytes(bytes) {
    const ds = new DecompressionStream("deflate");
    const w = ds.writable.getWriter();
    w.write(bytes);
    w.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

async function deriveKey(password) {
    const enc = new TextEncoder();
    const km = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: enc.encode("vless-salt"),
            iterations: 50000,
            hash: "SHA-256",
        },
        km,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

async function encrypt(text, password) {
    const enc = new TextEncoder();
    const data = await deflateBytes(enc.encode(text));
    if (!password) return bytesToBase32(data);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password);
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
    const payload = new Uint8Array(iv.length + ct.byteLength);
    payload.set(iv, 0);
    payload.set(new Uint8Array(ct), iv.length);
    return bytesToBase32(payload);
}

async function decrypt(text, password) {
    const data = base32ToBytes(text);
    if (!password) {
        const inflated = await inflateBytes(data);
        return new TextDecoder().decode(inflated);
    }
    const iv = data.slice(0, 12);
    const ct = data.slice(12);
    const key = await deriveKey(password);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    const inflated = await inflateBytes(new Uint8Array(pt));
    return new TextDecoder().decode(inflated);
}

const TO_FA_DEFAULT = {
    a:"ش",b:"ل",c:"ض",d:"ب",e:"ع",f:"گ",g:"و",h:"ظ",
    i:"س",j:"ژ",k:"ک",l:"م",m:"ن",n:"پ",o:"غ",p:"ح",
    q:"ز",r:"ط",s:"ر",t:"ق",u:"ث",v:"ف",w:"ی",x:"د",
    y:"ذ",z:"خ","2":"۲","3":"۳","4":"۴","5":"۵","6":"۶","7":"۷"
};

const TO_EN_DEFAULT = Object.fromEntries(
    Object.entries(TO_FA_DEFAULT).map(([k, v]) => [v, k])
);

const FA32 = "ابتثجچحخدذرزسشصضطظعغفقکگلمنوهی";

function encodeByMode(raw, mode) {
    if (mode === "en-only") return raw;
    if (mode === "default") return raw.split("").map(c => TO_FA_DEFAULT[c] || c).join("");
    if (mode === "fa-only") {
        return raw.split("").map(c => {
            const i = BASE32.indexOf(c);
            return i >= 0 ? FA32[i] : c;
        }).join("");
    }
    return raw;
}

function decodeByMode(input, mode) {
    if (mode === "en-only") return input;
    if (mode === "default") return input.split("").map(c => TO_EN_DEFAULT[c] || c).join("");
    if (mode === "fa-only") {
        return input.split("").map(c => {
            const i = FA32.indexOf(c);
            return i >= 0 ? BASE32[i] : c;
        }).join("");
    }
    return input;
}

document.addEventListener("DOMContentLoaded", () => {
    const tabs = document.querySelectorAll(".tab-button");
    const contents = document.querySelectorAll(".tab-content");

    const pass = document.getElementById("cryptoPassword");
    const algoSelect = document.getElementById("algoSelect");

    const encodeInput = document.getElementById("encode-input");
    const encodeOutput = document.getElementById("encode-output");
    const encodeCopy = document.getElementById("encode-copy");
    const encodeRegenerate = document.getElementById("encode-regenerate");

    const decodeInput = document.getElementById("decode-input");
    const decodeOutput = document.getElementById("decode-output");
    const decodeCopy = document.getElementById("decode-copy");
    const decodeError = document.getElementById("decode-error");

    const algoHint = document.getElementById("algoHint");

    let lastEncodedMapped = "";

    const setDirectionByAlgo = () => {
        const isFa = algoSelect.value !== "en-only";
        encodeOutput.classList.toggle("dir-rtl", isFa);
        encodeOutput.classList.toggle("dir-ltr", !isFa);
        decodeInput.classList.toggle("dir-rtl", isFa);
        decodeInput.classList.toggle("dir-ltr", !isFa);
    };

    const setHint = () => {
        const v = algoSelect.value;
        if (v === "default") algoHint.textContent = "پیش‌فرض: مناسب برای اکثر پیام‌رسان‌ها";
        if (v === "fa-only") algoHint.textContent = "خوانا: فقط حروف فارسی، ممکن است برای SMS مناسب نباشد";
        if (v === "en-only") algoHint.textContent = "سازگار: انگلیسی + عدد، معمولاً برای SMS بهتر است";
    };

    const runEncode = async () => {
        try {
            setDirectionByAlgo();
            if (!encodeInput.value) {
                lastEncodedMapped = "";
                encodeOutput.textContent = "";
                encodeCopy.disabled = true;
                encodeRegenerate.disabled = true;
                return;
            }
            const raw = await encrypt(encodeInput.value, pass.value);
            const mapped = encodeByMode(raw, algoSelect.value);
            lastEncodedMapped = mapped;
            encodeOutput.textContent = mapped;
            encodeCopy.disabled = false;
            encodeRegenerate.disabled = false;
        } catch {
            lastEncodedMapped = "";
            encodeOutput.textContent = "";
            encodeCopy.disabled = true;
            encodeRegenerate.disabled = true;
        }
    };

    const runDecode = async () => {
        try {
            setDirectionByAlgo();
            decodeError.style.display = "none";
            if (!decodeInput.value) {
                decodeOutput.textContent = "";
                decodeCopy.disabled = true;
                return;
            }
            const raw = decodeByMode(decodeInput.value, algoSelect.value);
            decodeOutput.textContent = await decrypt(raw, pass.value);
            decodeCopy.disabled = false;
        } catch {
            decodeOutput.textContent = "";
            decodeCopy.disabled = true;
            decodeError.style.display = "block";
        }
    };

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            const id = tab.dataset.tab;
            contents.forEach(c => c.classList.toggle("active", c.id === id));
            if (id === "encode" && lastEncodedMapped) {
                encodeOutput.textContent = lastEncodedMapped;
                encodeCopy.disabled = false;
                encodeRegenerate.disabled = false;
            }
        });
    });

    ["input", "paste"].forEach(ev => {
        encodeInput.addEventListener(ev, () => setTimeout(runEncode, 0));
        decodeInput.addEventListener(ev, () => setTimeout(runDecode, 0));
        pass.addEventListener(ev, () => {
            decodeError.style.display = "none";
            setTimeout(runEncode, 0);
            setTimeout(runDecode, 0);
        });
    });

    algoSelect.addEventListener("change", () => {
        setHint();
        setDirectionByAlgo();
        setTimeout(runEncode, 0);
        setTimeout(runDecode, 0);
    });

    encodeCopy.addEventListener("click", () =>
        navigator.clipboard.writeText(encodeOutput.textContent)
    );

    encodeRegenerate.addEventListener("click", async () => {
        await runEncode();
    });

    decodeCopy.addEventListener("click", () =>
        navigator.clipboard.writeText(decodeOutput.textContent)
    );

    setHint();
    setDirectionByAlgo();
});

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js");
    if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage("GET_VERSION");
    }
    navigator.serviceWorker.addEventListener("message", e => {
        if (e.data?.version) {
            document.querySelector(".version").textContent = `ورژن ${e.data.version}`;
        }
    });
}
