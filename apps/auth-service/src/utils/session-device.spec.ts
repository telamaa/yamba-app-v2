/** session-device.spec.ts — D65 2A : un libellé grossier, jamais une empreinte. */
import { describeUserAgent, UNKNOWN_DEVICE, shortUserAgent, isDeviceKnown } from "./session-device";

describe("describeUserAgent", () => {
  it("reconnaît navigateur et système courants", () => {
    expect(describeUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36")).toBe("Chrome · macOS");
    expect(describeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")).toBe("Safari · iOS");
    expect(describeUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36")).toBe("Chrome · Android");
    expect(describeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0")).toBe("Firefox · Windows");
    expect(describeUserAgent("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/128.0 Safari/537.36 Edg/128.0")).toBe("Edge · Windows");
  });
  it("inconnu quand rien n'est reconnaissable ; le user-agent stocké est tronqué", () => {
    expect(describeUserAgent(null)).toBe(UNKNOWN_DEVICE);
    expect(describeUserAgent("curl/8.4.0")).toBe(UNKNOWN_DEVICE);
    expect(describeUserAgent("YambaMobile/1.0 (Android)")).toBe("Application Yamba · Android");
    expect(shortUserAgent("x".repeat(500))?.length).toBe(200);
    expect(shortUserAgent(null)).toBeNull();
  });
});

describe("isDeviceKnown (D78)", () => {
  it("connu si le libellé figure parmi les sessions actives", () => {
    expect(isDeviceKnown(["Chrome · macOS", "Safari · iOS"], "Safari · iOS")).toBe(true);
  });
  it("nouveau si absent de la liste", () => {
    expect(isDeviceKnown(["Chrome · macOS"], "Firefox · Windows")).toBe(false);
  });
  it("un appareil inconnu / vide n'est jamais « connu » (on prévient plutôt que taire)", () => {
    expect(isDeviceKnown([UNKNOWN_DEVICE, "Chrome · macOS"], UNKNOWN_DEVICE)).toBe(false);
    expect(isDeviceKnown(["Chrome · macOS"], "")).toBe(false);
    expect(isDeviceKnown(["Chrome · macOS"], null)).toBe(false);
  });
});
