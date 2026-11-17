import "./style.css";
import {
  branchKeys,
  branches,
  flowFrames,
  type Keyframe,
  type Pose,
  type Scenario,
} from "./sample-data";
import { createFighter, drawFighter, project } from "./sample-renderer";

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing sample element: ${selector}`);
  return element;
}

function mount(rootId: string, hasBranches = false): void {
  const root = required<HTMLElement>(document, `#${rootId}`);
  const svg = required<SVGSVGElement>(root, "svg");
  const button = required<HTMLButtonElement>(root, "[data-play]");
  const speed = required<HTMLSelectElement>(root, "[data-speed]");
  const status = required<HTMLOutputElement>(root, "output");
  const scenario = hasBranches
    ? required<HTMLSelectElement>(root, "[data-scenario]")
    : null;
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

  function selectedFrames(): Keyframe[] {
    const value = scenario?.value;
    return value && Object.hasOwn(branches, value)
      ? branchKeys(value as Scenario)
      : flowFrames;
  }

  let keys = selectedFrames();
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

  scenario?.addEventListener("change", () => {
    cancelAnimationFrame(raf);
    running = false;
    time = 0;
    keys = selectedFrames();
    button.textContent = reducedMotion.matches
      ? "次の動きを見る"
      : "攻防を再生";
    render(0);
  });

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
  render(0);
}

mount("gladios-lines");
mount("gladios-offbalance", true);
