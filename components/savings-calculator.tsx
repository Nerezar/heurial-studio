"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { tone } from "@/lib/style";

// The assumptions are shown to the visitor under the sliders. Change them there too.
const PRICE = 495; // founding price
const SHARE = 0.7; // part of the task a workflow takes over
const WEEKS = 50; // working weeks in a year

const usd = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function minutesLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h${rest ? ` ${rest} min` : ""}`;
}

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

/** Lets a visitor estimate what one repeated task costs them in a year. Plain arithmetic on their own numbers. */
export function SavingsCalculator() {
  const [minutes, setMinutes] = useState(45);
  const [days, setDays] = useState(5);
  const [rate, setRate] = useState(50);

  const hoursBack = (minutes / 60) * days * WEEKS * SHARE;
  const valueBack = hoursBack * rate;
  const paybackWeeks = valueBack > 0 ? PRICE / (valueBack / WEEKS) : Infinity;
  const pays = paybackWeeks <= WEEKS;

  // Chart: value of time saved builds across the year; the dashed line is the one-off price.
  const ceiling = Math.max(valueBack, PRICE * 1.3) * 1.14;
  const y = (value: number) => 100 - (value / ceiling) * 100;
  const endY = y(valueBack);
  const costY = y(PRICE);
  const breakX = pays ? (paybackWeeks / WEEKS) * 100 : null;

  const summary = pays
    ? `About ${Math.round(hoursBack)} hours back a year, worth about ${usd(valueBack)} of your time. A $495 workflow pays for itself in ${paybackLabel(paybackWeeks)}.`
    : `About ${Math.round(hoursBack)} hours back a year, worth about ${usd(valueBack)} of your time. At these numbers a $495 workflow would not pay for itself within a year.`;

  return <div className="calc" data-no-reveal>
    <form className="glass calc-inputs" onSubmit={(event) => event.preventDefault()} aria-label="Your numbers">
      <Slider id="calc-minutes" label="Time it takes each day" value={minutes} min={5} max={180} step={5} format={minutesLabel} onChange={setMinutes} />
      <Slider id="calc-days" label="Days a week you do it" value={days} min={1} max={7} step={1} format={(value) => `${value} day${value === 1 ? "" : "s"}`} onChange={setDays} />
      <Slider id="calc-rate" label="What an hour of your time is worth" value={rate} min={15} max={200} step={5} format={(value) => `${usd(value)} an hour`} onChange={setRate} />
      <p className="calc-fine">This is an estimate from your numbers, not a promise. It assumes a workflow takes over about 70% of the task across 50 working weeks, and it leaves out any tool fees.</p>
    </form>

    <div className="glass is-glow glow-bottom calc-result">
      <div className="calc-result-head">
        <span>Your estimate</span>
        {pays
          ? <span className="chip" style={tone("green")}><i aria-hidden="true" />Pays for itself in {paybackLabel(paybackWeeks)}</span>
          : <span className="chip" style={tone("amber")}><i aria-hidden="true" />Probably not worth automating</span>}
      </div>
      <div className="calc-chart" aria-hidden="true">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="calc-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgb(110 165 255)" stopOpacity=".38" />
              <stop offset="1" stopColor="rgb(110 165 255)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[20, 40, 60, 80].map((line) => <line className="calc-grid" key={`h${line}`} x1="0" x2="100" y1={line} y2={line} />)}
          {[20, 40, 60, 80].map((line) => <line className="calc-grid" key={`v${line}`} y1="0" y2="100" x1={line} x2={line} />)}
          <path className="calc-area" d={`M0,100 L100,${endY} L100,100 Z`} />
          <line className="calc-cost" x1="0" x2="100" y1={costY} y2={costY} />
          <line className="calc-line" x1="0" y1="100" x2="100" y2={endY} />
        </svg>
        <span className="calc-cost-label" style={{ top: `${costY}%`, ...(breakX !== null && breakX > 66 ? { left: 0, right: "auto" } : {}) }}>$495 workflow</span>
        {breakX !== null && <span className="calc-dot" style={{ left: `${breakX}%`, top: `${costY}%` }} />}
        <span className="calc-axis"><i>Today</i><i>One year</i></span>
      </div>
      <div className="calc-figure">
        <p className="calc-big"><strong className="num">{Math.round(hoursBack)}</strong><span>hours back a year</span></p>
        <p className="calc-sub">
          Worth about <b className="num">{usd(valueBack)}</b> of your time.{" "}
          {pays ? "The dot marks where the workflow has paid for itself." : "At these numbers it wouldn’t pay for itself within a year, so this task probably isn’t the one to automate."}
        </p>
      </div>
      <p className="sr-only" role="status">{summary}</p>
    </div>
  </div>;
}
