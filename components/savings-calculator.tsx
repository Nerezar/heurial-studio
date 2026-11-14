"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { tone } from "@/lib/style";

// The assumptions are shown to the visitor under the sliders. Change them there too.
const PRICE = 495; // founding price
const SHARE = 0.7; // part of the task a workflow takes over
const WEEKS = 50; // working weeks in a year
const WORK_WEEK = 40; // hours in a full work week

const count = (value: number) => Math.round(value).toLocaleString("en-US");
const usd = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function minutesLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h${rest ? ` ${rest} min` : ""}`;
}

// "3.3 work weeks", or "2 work days" when it's under a week.
function weeksLabel(hours: number) {
  const weeks = hours / WORK_WEEK;
  if (weeks < 1) { const days = Math.max(1, Math.round(hours / 8)); return `${days} work day${days === 1 ? "" : "s"}`; }
  const shown = weeks < 10 ? Math.round(weeks * 10) / 10 : Math.round(weeks);
  return `${shown} work week${shown === 1 ? "" : "s"}`;
}

const timesLabel = (times: number) => `${times < 10 ? Math.round(times * 10) / 10 : Math.round(times).toLocaleString("en-US")}×`;

function paybackLabel(weeks: number) {
  if (weeks < 1) return "under a week";
  if (weeks <= 12) return `about ${Math.ceil(weeks)} week${Math.ceil(weeks) === 1 ? "" : "s"}`;
  return `about ${Math.round(weeks / 4.33)} months`;
}

function Slider({ id, label, value, min, max, step, format, onChange }: {
  id: string; label: string; value: number; min: number; max: number; step: number;
  format: (value: number) => string; onChange: (value: number) => void;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return <div className="calc-field">
    <div className="calc-field-head"><label htmlFor={id}>{label}</label><output htmlFor={id}>{format(value)}</output></div>
    <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={format(value)}
      style={{ "--p": `${fill}%` } as CSSProperties} onChange={(event) => onChange(Number(event.target.value))} />
  </div>;
}

/**
 * Lets a visitor estimate what one repeated task costs them in a year. Plain arithmetic on their own numbers: every
 * figure shown is the same hours restated (as work weeks, as money, against the price), never a second assumption.
 */
export function SavingsCalculator() {
  const [minutes, setMinutes] = useState(45);
  const [days, setDays] = useState(5);
  const [people, setPeople] = useState(1);
  const [rate, setRate] = useState(50);

  const hoursNow = (minutes / 60) * days * WEEKS * people; // what the task takes today
  const costNow = hoursNow * rate;
  const hoursBack = hoursNow * SHARE;
  const valueBack = hoursBack * rate;
  const costAfter = PRICE + costNow - valueBack; // the one-off price plus the part that stays manual
  const paybackWeeks = valueBack > 0 ? PRICE / (valueBack / WEEKS) : Infinity;
  const pays = paybackWeeks <= WEEKS;
  const times = valueBack / PRICE;
  const team = people > 1 ? ` across ${people} people` : "";

  // Chart: what the task costs over a year done by hand, against the same year with a workflow. The gap is what's kept.
  const ceiling = Math.max(costNow, costAfter) * 1.16;
  const y = (value: number) => 100 - (value / ceiling) * 100;
  const handY = y(costNow);
  const afterY = y(costAfter);
  const startY = y(PRICE);
  const breakX = pays ? (paybackWeeks / WEEKS) * 100 : null;
  const breakY = breakX === null ? 0 : y(costNow * (breakX / 100));
  // When the two lines end close together their labels would collide, so they move to the top-left corner instead.
  const close = Math.abs(handY - afterY) < 14;

  const summary = pays
    ? `Today this task takes about ${count(hoursNow)} hours a year${team}. A workflow gives back about ${count(hoursBack)} of them: ${weeksLabel(hoursBack)}, worth about ${usd(valueBack)} of your time, or ${timesLabel(times)} the $495 price. It pays for itself in ${paybackLabel(paybackWeeks)}.`
    : `Today this task takes about ${count(hoursNow)} hours a year${team}. A workflow would give back about ${count(hoursBack)} of them, worth about ${usd(valueBack)} of your time. At these numbers a $495 workflow would not pay for itself within a year.`;

  return <div className="calc" data-no-reveal>
    <form className="glass calc-inputs" onSubmit={(event) => event.preventDefault()} aria-label="Your numbers">
      <Slider id="calc-minutes" label="Time it takes each day" value={minutes} min={5} max={180} step={5} format={minutesLabel} onChange={setMinutes} />
      <Slider id="calc-days" label="Days a week it gets done" value={days} min={1} max={7} step={1} format={(value) => `${value} day${value === 1 ? "" : "s"}`} onChange={setDays} />
      <Slider id="calc-people" label="People who do it" value={people} min={1} max={10} step={1} format={(value) => (value === 1 ? "Just me" : `${value} people`)} onChange={setPeople} />
      <Slider id="calc-rate" label="What an hour of that time is worth" value={rate} min={15} max={200} step={5} format={(value) => `${usd(value)} an hour`} onChange={setRate} />
      <p className="calc-fine">This is an estimate from your numbers, not a promise. It assumes a workflow takes over about 70% of the task across 50 working weeks, counts a work week as 40 hours, and leaves out any tool fees. The money is the value of time, not cash in the bank.</p>
    </form>

    <div className="glass is-glow calc-result">
      <div className="calc-result-head">
        <span>One year of this task</span>
        {pays
          ? <span className="chip" style={tone("green")}><i aria-hidden="true" />Pays for itself in {paybackLabel(paybackWeeks)}</span>
          : <span className="chip" style={tone("amber")}><i aria-hidden="true" />Probably not worth automating</span>}
      </div>
      <div className="calc-chart" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="calc-fill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgb(110 165 255)" stopOpacity=".04" />
              <stop offset="1" stopColor="rgb(110 165 255)" stopOpacity=".3" />
            </linearGradient>
          </defs>
          {[20, 40, 60, 80].map((line) => <line className="calc-grid" key={`h${line}`} x1="0" x2="100" y1={line} y2={line} />)}
          {[20, 40, 60, 80].map((line) => <line className="calc-grid" key={`v${line}`} y1="0" y2="100" x1={line} x2={line} />)}
          {breakX !== null && <path className="calc-area" d={`M${breakX},${breakY} L100,${handY} L100,${afterY} Z`} />}
          <line className="calc-hand" x1="0" y1="100" x2="100" y2={handY} />
          <line className="calc-line" x1="0" y1={startY} x2="100" y2={afterY} />
        </svg>
        <span className={`calc-tag is-hand${close ? " is-corner" : ""}`} style={close ? { top: 0 } : { top: `${handY}%` }}>By hand <b className="num">{usd(costNow)}</b></span>
        <span className={`calc-tag${close ? " is-corner" : ""}`} style={close ? { top: 20 } : { top: `${afterY}%` }}>With a $495 workflow <b className="num">{usd(costAfter)}</b></span>
        {breakX !== null && <span className="calc-dot" style={{ left: `${breakX}%`, top: `${breakY}%` }} />}
        <span className="calc-axis"><i>Today</i><i>One year</i></span>
      </div>
      <div className="calc-figure">
        <p className="calc-big"><strong className="num">{count(hoursBack)}</strong><span>hours back a year{team}</span></p>
        {pays
          ? <dl className="calc-stats">
            <div><dt>you get back</dt><dd className="num">{weeksLabel(hoursBack)}</dd></div>
            <div><dt>of your time</dt><dd className="num">{usd(valueBack)}</dd></div>
            <div><dt>the $495 price</dt><dd className="num">{timesLabel(times)}</dd></div>
          </dl>
          : null}
        <p className="calc-sub">
          Today this task takes about <b className="num">{count(hoursNow)}</b> hours a year{team}.{" "}
          {pays ? "The dot marks where the workflow has paid for itself; the shaded gap is what you keep." : "At these numbers a workflow wouldn’t pay for itself within a year, so this task probably isn’t the one to automate."}
        </p>
      </div>
      <p className="sr-only" role="status">{summary}</p>
    </div>
  </div>;
}
