import { loginAlertMode } from "./notify-sign-in";

describe("loginAlertMode (D78)", () => {
  it("défaut = new-device", () => {
    expect(loginAlertMode({})).toBe("new-device");
    expect(loginAlertMode({ LOGIN_ALERT_MODE: "" })).toBe("new-device");
    expect(loginAlertMode({ LOGIN_ALERT_MODE: "nawak" })).toBe("new-device");
  });
  it("« every » et « off » sont reconnus, insensibles à la casse/espaces", () => {
    expect(loginAlertMode({ LOGIN_ALERT_MODE: "every" })).toBe("every");
    expect(loginAlertMode({ LOGIN_ALERT_MODE: " EVERY " })).toBe("every");
    expect(loginAlertMode({ LOGIN_ALERT_MODE: "off" })).toBe("off");
    expect(loginAlertMode({ LOGIN_ALERT_MODE: "OFF" })).toBe("off");
  });
});
