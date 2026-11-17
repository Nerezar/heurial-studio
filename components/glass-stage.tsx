import type { ReactNode } from "react";
import Image from "next/image";
import { Icon } from "./icon";

/** One sheet of glass: a rim that gives it thickness, then the face. */
function Sheet({ kind, children }: { kind: string; children?: ReactNode }) {
  return <>
    <span className={`stage-edge is-${kind}`}><i /></span>
    <div className={`stage-sheet is-${kind}`}>{children}</div>
  </>;
}

/** Hero illustration: a sample lead follow-up workflow on tilted glass panels. Decorative, drawn in CSS. */
export function GlassStage() {
  return <div className="stage" role="img" aria-label="Illustration: a sample lead follow-up workflow on layered glass panels">
    <div className="stage-scene" aria-hidden="true">
      <span className="stage-floor" />
      <Sheet kind="slab" />
      <Sheet kind="back" />
      <Sheet kind="main">
        <p className="stage-title">Lead follow-up <span>Sample</span></p>
        <ol className="stage-flow">
          <li><Icon name="mail" />New inquiry</li>
          <li className="is-live"><Icon name="spark" />Draft reply</li>
          <li><Icon name="calendar" />Booked</li>
        </ol>
        <div className="stage-lines"><i /><i /><i /><i /></div>
      </Sheet>
      <Sheet kind="side">
        <Image className="stage-mark" src="/brand/mark.svg" alt="" width={816} height={728} />
        <ul className="stage-nav">
          <li className="is-on"><Icon name="grid" />Overview</li>
          <li><Icon name="mail" />Inquiries</li>
          <li><Icon name="repeat" />Follow-ups</li>
          <li><Icon name="calendar" />Bookings</li>
        </ul>
      </Sheet>
    </div>
  </div>;
}
