import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import {
  i18n,
  readStoredLanguagePreference,
  setAppLanguage,
} from "../../i18n.ts";
import { LanguageSetting } from "../../features/settings/ui/LanguageSetting.tsx";
import { uiMessage, uiT, useUiLanguage } from "./uiTranslation.ts";

afterEach(async () => {
  cleanup();
  await setAppLanguage("en");
  localStorage.clear();
});

test("the real selector changes mounted labels without remounting or editing a draft", async () => {
  await setAppLanguage("en");
  const descriptor = {
    get label() {
      return uiT("Settings");
    },
  };
  let mounts = 0;
  function Screen() {
    useUiLanguage();
    React.useEffect(() => {
      mounts += 1;
    }, []);
    const [draft, setDraft] = React.useState("");
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(LanguageSetting),
      React.createElement("h1", null, descriptor.label),
      React.createElement("textarea", {
        "aria-label": "draft",
        value: draft,
        onChange: (event) => setDraft(event.target.value),
      }),
      React.createElement("pre", null, draft),
    );
  }
  const screen = render(React.createElement(Screen));
  const draft = "Settings 파일.txt / 한글 입력 {{p0}} <b>원문</b> $t(sample)";
  const input = screen.getByRole("textbox", { name: "draft" });
  fireEvent.change(input, { target: { value: draft } });
  await act(async () =>
    fireEvent.change(screen.getByTestId("app-language"), {
      target: { value: "ko" },
    }),
  );
  assert.equal(screen.getByRole("heading").textContent, "설정");
  assert.equal(document.documentElement.lang, "ko");
  assert.equal(readStoredLanguagePreference(), "ko");
  assert.equal(input.value, draft);
  assert.equal(screen.container.querySelector("pre").textContent, draft);
  assert.equal(mounts, 1);
  await act(async () =>
    fireEvent.change(screen.getByTestId("app-language"), {
      target: { value: "en" },
    }),
  );
  assert.equal(screen.getByRole("heading").textContent, "Settings");
  assert.equal(input.value, draft);
  assert.equal(mounts, 1);
});

test("rich translations preserve an inline link and its callback", async () => {
  await setAppLanguage("ko");
  let clicks = 0;
  const link = React.createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        clicks += 1;
      },
    },
    "원문 이름 <script>",
  );
  const screen = render(
    React.createElement(
      "p",
      null,
      uiMessage("This is the beginning of the {0}.", { p0: link }),
    ),
  );
  assert.equal(
    screen.container.textContent,
    "원문 이름 <script>의 시작입니다.",
  );
  fireEvent.click(screen.getByRole("button"));
  assert.equal(clicks, 1);
  assert.equal(screen.container.querySelector("script"), null);
});

test("interpolation preserves user values, counts, fallback and literal unknown text", async () => {
  await setAppLanguage("ko");
  const userValue = "<b>{{p1}} $t(sample) Settings 한글.txt</b>";
  assert.ok(uiT("Profile sync: {0}", { p0: userValue }).includes(userValue));
  for (const count of [0, 1, 2, 100]) {
    assert.equal(
      uiT("Remove {0} member{1}?", { p0: count, p1: count === 1 ? "" : "s" }),
      `멤버 ${count}명을 제거할까요?`,
    );
  }
  assert.equal(
    uiT("Unregistered original user text"),
    "Unregistered original user text",
  );
  await i18n.changeLanguage("zh-Hans");
  assert.equal(
    uiT("Profile sync: {0}", { p0: userValue }),
    `Profile sync: ${userValue}`,
  );
});

test("failed storage applies the language and reports that it was not saved", async () => {
  const prototype = Object.getPrototypeOf(localStorage);
  const original = prototype.setItem;
  prototype.setItem = () => {
    throw new Error("storage denied");
  };
  try {
    const result = await setAppLanguage("ko");
    assert.equal(result.saved, false);
    assert.equal(uiT("Settings"), "설정");
    assert.equal(document.documentElement.lang, "ko");
  } finally {
    prototype.setItem = original;
  }
});
