"use client";

import { Fragment, useEffect, useState } from "react";
import { Icon } from "./icon";

const stages = [
  { name: "Inquiry", icon: "mail", text: "A new inquiry comes in from your website form and is logged." },
  { name: "Follow-up", icon: "repeat", text: "A reply is drafted for you to approve. Leads who go quiet get a nudge." },
  { name: "Booking", icon: "calendar", text: "They pick a time, and it goes on your calendar." },
];

/** Three stages of one sample workflow. It steps through them by itself until you pick one. */
export function ExampleFlow() {
  const [on, setOn] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setOn((current) => (current + 1) % stages.length), 3200);
    return () => clearInterval(timer);
  }, [auto]);

  return <div className="ed-example">
    <p className="label">A simple example<i aria-hidden="true" /></p>
    <div className="ed-example-row">
      {stages.map(({ name, icon }, index) => <Fragment key={name}>
        {index > 0 && <Icon name="arrow" />}
        <button type="button" aria-pressed={on === index} onClick={() => { setOn(index); setAuto(false); }}><Icon name={icon} />{name}</button>
      </Fragment>)}
    </div>
    <p className="ed-example-text" key={on} aria-live={auto ? "off" : "polite"}>{stages[on].text}</p>
  </div>;
}
