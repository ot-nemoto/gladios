import "./style.css";
import type { Pose } from "./sample-data";
import {
  sampleCases,
  skillNames,
  type SampleCase,
  type SkillCue,
  type SkillId,
} from "./sample-cases";
import { createFighter, drawFighter, project } from "./sample-renderer";

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing sample element: ${selector}`);
  return element;
}

function mount(): void {
  const root = required<HTMLElement>(document, "#battle-panel");
  const svg = required<SVGSVGElement>(root, "svg");
  const button = required<HTMLButtonElement>(root, "[data-play]");
  const speed = required<HTMLSelectElement>(root, "[data-speed]");
  const status = required<HTMLOutputElement>(root, "output");
  const tabs = [
    ...document.querySelectorAll<HTMLButtonElement>('[role="tab"][data-case]'),
  ];
  let activeCase: SampleCase = sampleCases[0]!;
  const left = createFighter(
    required<SVGGElement>(root, '[data-fighter="left"]'),
    1,
  );
  const right = createFighter(
    required<SVGGElement>(root, '[data-fighter="right"]'),
    -1,
  );
  const contact = required<SVGGElement>(root, "[data-contact]");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  let keys = activeCase.frames;
  const skillPanels = (["left", "right"] as const).map((side) => {
    const list = required<HTMLUListElement>(root, `[data-skills="${side}"]`);
    const current = required<HTMLElement>(root, `[data-current="${side}"]`);
    let items = new Map<SkillId, HTMLLIElement>();
    let previous: SkillId | null | undefined;
    return {
      setCues(cues: SkillCue[]): void {
        items = new Map();
        list.replaceChildren();
        for (const skill of new Set(cues.map((cue) => cue.skill))) {
          const item = document.createElement("li");
          item.dataset.skill = skill;
          item.append(skillNames[skill]);
          const indicator = document.createElement("span");
          indicator.className = "skill-indicator";
          indicator.textContent = "使用中";
          item.append(indicator);
          items.set(skill, item);
          list.append(item);
        }
        previous = undefined;
      },
      update(t: number, duration: number): void {
        const skill =
          t > 0 && t < duration
            ? (activeCase[side].find((cue) => t > cue.from && t < cue.to)
                ?.skill ?? null)
            : null;
        if (previous !== skill) {
          for (const [id, item] of items) {
            item.classList.toggle("active", id === skill);
            if (id === skill) item.setAttribute("aria-current", "true");
            else item.removeAttribute("aria-current");
          }
          previous = skill;
        }
        const text =
          t === 0
            ? "待機"
            : t >= duration
              ? "終了"
              : skill
                ? `現在：${skillNames[skill]}`
                : "使用中のスキルなし";
        if (current.textContent !== text) current.textContent = text;
      },
    };
  });
  function setSkillLists(): void {
    skillPanels[0]!.setCues(activeCase.left);
    skillPanels[1]!.setCues(activeCase.right);
  }
  let time = 0;
  let last = 0;
  let raf = 0;
  let running = false;
  const duration = (): number => keys[keys.length - 1]!.t;

  function mix(a: Pose, b: Pose, amount: number): Pose {
    return a.map(
      (value, i) => value + (b[i]! - value) * amount,
    ) as unknown as Pose;
  }

  function render(t: number): void {
    let index = 0;
    while (index < keys.length - 2 && t >= keys[index + 1]!.t) index++;
    const a = keys[index]!;
    const b = keys[index + 1]!;
    const fraction = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
    const eased = fraction * fraction * (3 - 2 * fraction);
    drawFighter(left, mix(a.l, b.l, eased), 1);
    drawFighter(right, mix(a.r, b.r, eased), -1);
    const pose = fraction > 0.7 ? b : a;
    const text = pose.text;
    if (status.textContent !== text) status.textContent = text;
    const point =
      b.contact && fraction > 0.86
        ? b.contact
        : a.contact && fraction < 0.16
          ? a.contact
          : null;
    contact.setAttribute("opacity", point ? "1" : "0");
    if (point)
      contact.setAttribute(
        "transform",
        `translate(${project(point[0], point[1])})`,
      );
    svg.dataset.time = String(Math.round(t));
    for (const panel of skillPanels) panel.update(t, duration());
  }

  function finish(): void {
    time = duration();
    render(time);
    running = false;
    button.textContent = "もう一度再生";
  }

  function tick(now: number): void {
    time = Math.min(
      duration(),
      time + Math.max(0, now - last) * Number(speed.value),
    );
    last = now;
    render(time);
    if (time < duration()) raf = requestAnimationFrame(tick);
    else finish();
  }

  button.addEventListener("click", () => {
    if (running) {
      cancelAnimationFrame(raf);
      running = false;
      button.textContent = "続きを再生";
      return;
    }
    if (reducedMotion.matches) {
      // 動きを減らす場合も、各段階を静止画で確認できる。
      time = time >= duration() ? 0 : keys.find((key) => key.t > time)!.t;
      render(time);
      button.textContent =
        time >= duration() ? "もう一度見る" : "次の動きを見る";
      return;
    }
    if (time >= duration()) time = 0;
    running = true;
    last = performance.now();
    button.textContent = "一時停止";
    raf = requestAnimationFrame(tick);
  });

  function selectCase(tab: HTMLButtonElement): void {
    const selected = sampleCases.find(
      (sample) => sample.id === tab.dataset.case,
    );
    if (!selected || selected === activeCase) return;
    cancelAnimationFrame(raf);
    running = false;
    time = 0;
    activeCase = selected;
    keys = activeCase.frames;
    for (const item of tabs) {
      const isSelected = item === tab;
      item.setAttribute("aria-selected", String(isSelected));
      item.tabIndex = isSelected ? 0 : -1;
    }
    root.setAttribute("aria-labelledby", tab.id);
    root.dataset.case = activeCase.id;
    setSkillLists();
    button.textContent = reducedMotion.matches
      ? "次の動きを見る"
      : "攻防を再生";
    render(0);
  }
  for (const tab of tabs) {
    tab.addEventListener("click", () => selectCase(tab));
    tab.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        return;
      const index = tabs.indexOf(tab);
      const next =
        event.key === "ArrowRight"
          ? (index + 1) % tabs.length
          : event.key === "ArrowLeft"
            ? (index + tabs.length - 1) % tabs.length
            : event.key === "Home"
              ? 0
              : event.key === "End"
                ? tabs.length - 1
                : null;
      if (next === null) return;
      event.preventDefault();
      const target = tabs[next]!;
      selectCase(target);
      target.focus();
    });
  }

  reducedMotion.addEventListener("change", () => {
    if (running && reducedMotion.matches) {
      cancelAnimationFrame(raf);
      running = false;
    }
    button.textContent = reducedMotion.matches
      ? time >= duration()
        ? "もう一度見る"
        : "次の動きを見る"
      : time >= duration()
        ? "もう一度再生"
        : time > 0
          ? "続きを再生"
          : "攻防を再生";
  });

  button.textContent = reducedMotion.matches ? "次の動きを見る" : "攻防を再生";
  root.dataset.case = activeCase.id;
  setSkillLists();
  render(0);
}

mount();
