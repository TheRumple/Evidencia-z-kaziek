export function DashboardStyles() {
  return (
    <style jsx global>{`
        .headerCompact {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .headerCompactActions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sidebarNav a {
          text-align: center;
        }

        .desktopTable {
          display: block;
        }

        .mobileCards {
          display: none;
        }
        .headerWrap {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          align-items: center;
          flex-wrap: wrap;
        }

        .headerButtonsWrap {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 12px;
        }

        .secondaryActionsRow {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .summaryGrid {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }

        .filtersGrid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 12px;
        }

        .filtersGridOrders {
          grid-template-columns: 2fr 1.2fr 1fr 1.2fr;
        }

        .ordersControlPanel {
          background: linear-gradient(135deg, #0b1120 0%, #182235 68%, #243b12 100%) !important;
          border: 1px solid rgba(148, 163, 184, 0.24) !important;
          color: #fff;
          box-shadow: 0 20px 46px rgba(15, 23, 42, 0.18) !important;
        }

        .ordersControlHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }

        .ordersControlHeader h2 {
          margin: 0;
          color: #fff;
          font-size: 24px;
          line-height: 1.08;
          font-weight: 900;
        }

        .ordersControlHeader p {
          margin: 5px 0 0;
          color: rgba(226, 232, 240, 0.78);
          font-size: 13px;
          font-weight: 700;
        }

        .ordersEyebrow {
          color: #a3e635;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }

        .ordersVisibleBadge {
          border: 1px solid rgba(163, 230, 53, 0.45);
          background: rgba(132, 204, 22, 0.14);
          color: #ecfccb;
          border-radius: 999px;
          padding: 7px 11px;
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .ordersControlPanel label {
          color: rgba(226, 232, 240, 0.86) !important;
          font-weight: 900 !important;
        }

        .ordersControlPanel input,
        .ordersControlPanel select {
          background: rgba(15, 23, 42, 0.62) !important;
          border-color: rgba(148, 163, 184, 0.42) !important;
          color: #fff !important;
          min-height: 42px;
        }

        .ordersControlPanel input::placeholder {
          color: rgba(203, 213, 225, 0.62);
        }

        .ordersBoard {
          padding: 0 !important;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.98) !important;
        }

        .ordersSectionStack {
          display: grid;
          gap: 0;
        }

        .ordersSection {
          padding: 14px;
          border-top: 1px solid #e2e8f0;
        }

        .ordersSection:first-child {
          border-top: none;
        }

        .ordersSectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 10px;
          border: 1px solid #e2e8f0;
          background: linear-gradient(135deg, #f8fafc 0%, #eef6ff 100%);
          border-radius: 14px;
          padding: 10px 12px;
        }

        .ordersSectionHeader h3 {
          margin: 0;
          font-size: 15px;
          line-height: 1.1;
          font-weight: 900;
          color: #0f172a;
        }

        .ordersSectionHeader p {
          margin: 3px 0 0;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
        }

        .ordersSectionCount {
          min-width: 32px;
          height: 32px;
          border-radius: 999px;
          background: #0f172a;
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.16);
        }

        .ordersSection-overdue .ordersSectionHeader {
          background: linear-gradient(135deg, #fff1f2 0%, #fff7ed 100%);
          border-color: #fecdd3;
        }

        .ordersSection-pripnute .ordersSectionHeader {
          background: linear-gradient(135deg, #ecfccb 0%, #f7fee7 100%);
          border-color: #bef264;
        }

        .ordersCardsStack {
          display: grid;
          gap: 10px;
        }

        .ordersEmptyState {
          margin: 14px;
          padding: 22px;
          border-radius: 16px;
          border: 1px dashed #cbd5e1;
          background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
          text-align: center;
          color: #64748b;
          display: grid;
          gap: 5px;
        }

        .ordersEmptyState strong {
          color: #0f172a;
          font-size: 15px;
        }

        .orderCard {
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }

        .orderCard:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 32px rgba(15, 23, 42, 0.12) !important;
        }

        .orderCardTitle {
          font-weight: 900;
          font-size: 15px;
          line-height: 1.14;
          color: #0f172a;
          overflow-wrap: anywhere;
        }

        .orderCardCustomer {
          margin-top: 4px;
          color: #475569;
          font-size: 13px;
          font-weight: 800;
        }

        .modalGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .workLogGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .orderRowSummary {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) auto;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
        }

        .orderRowMeta {
          display: flex;
          align-items: center;
          gap: 8px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .orderMetaChip {
          min-width: 74px;
          min-height: 38px;
          padding: 7px 9px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #fff;
          display: inline-flex;
          align-items: flex-start;
          justify-content: center;
          flex-direction: column;
          gap: 2px;
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.04);
        }

        .orderMetaLabel {
          font-size: 11px;
          line-height: 1;
          color: #64748b;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .orderDetailGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .calendarLayout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 12px;
          align-items: start;
        }

        .calendarPlannerLayout {
          display: grid;
          grid-template-columns: 310px minmax(0, 1fr);
          gap: 12px;
          align-items: start;
        }

        .calendarGrid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 8px;
        }

        .calendarWeekDays {
          margin-bottom: 8px;
          color: #64748b;
          font-size: 12px;
          font-weight: 900;
          text-align: center;
        }

        .calendarDay {
          min-height: 116px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 8px;
          overflow: hidden;
        }

        .calendarOrder {
          width: 100%;
          border-radius: 8px;
          padding: 4px 6px;
          font-size: 11px;
          font-weight: 900;
          line-height: 1.2;
          cursor: pointer;
          text-align: left;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .calendarPlanForm {
          display: grid;
          grid-template-columns: minmax(220px, 1.6fr) 150px 110px 110px minmax(180px, 1fr) auto;
          gap: 10px;
          align-items: end;
        }

        .calendarTaskForm {
          display: grid;
          grid-template-columns: minmax(240px, 1.4fr) 150px 110px 110px minmax(180px, 1fr) auto;
          gap: 10px;
          align-items: end;
        }

        .calendarPlanLabel {
          display: block;
          font-size: 12px;
          font-weight: 900;
          color: #475569;
          margin-bottom: 5px;
        }

        .calendarPlanInput {
          width: 100%;
          min-height: 42px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          background: #fff;
          color: #0f172a;
          padding: 8px 10px;
          font-size: 14px;
          font-weight: 700;
        }

        .calendarPlanItem {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 22px;
          gap: 3px;
          align-items: stretch;
        }

        .calendarPlanMain {
          min-width: 0;
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #14532d;
          border-radius: 8px;
          padding: 4px 6px;
          cursor: pointer;
          text-align: left;
          display: grid;
          gap: 1px;
        }

        .calendarPlanMain span {
          font-size: 10px;
          line-height: 1;
          font-weight: 900;
        }

        .calendarPlanMain strong {
          min-width: 0;
          font-size: 11px;
          line-height: 1.15;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .calendarPlanDelete {
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #be123c;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 900;
          line-height: 1;
        }

        .calendarPlanTask {
          border-color: #bfdbfe;
          background: #eff6ff;
          color: #1e3a8a;
        }

        .calendarDraggableOrder {
          border: 1px solid #e2e8f0;
          background: #fff;
          color: #0f172a;
          border-radius: 12px;
          padding: 10px;
          cursor: grab;
          text-align: left;
          display: grid;
          gap: 5px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
        }

        .calendarDraggableOrder:active {
          cursor: grabbing;
        }

        @media (max-width: 1150px) {
          .summaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .calendarLayout {
            grid-template-columns: 1fr;
          }

          .calendarPlannerLayout {
            grid-template-columns: 1fr;
          }

          .calendarPlanForm {
            grid-template-columns: 1fr 1fr;
          }

          .calendarTaskForm {
            grid-template-columns: 1fr 1fr;
          }

          .orderDetailGrid {
            grid-template-columns: 1fr;
          }

          .orderRowSummary {
            grid-template-columns: 1fr;
            align-items: stretch;
          }

          .orderRowMeta {
            justify-content: flex-start;
            grid-template-columns: repeat(auto-fit, minmax(86px, 1fr));
          }
        }

        @media (max-width: 1100px) {
          .layoutWrap {
            grid-template-columns: 1fr !important;
          }

          .sidebarNav {
            position: static !important;
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 768px) {
          .filtersGrid,
          .filtersGridOrders,
          .modalGrid,
          .summaryGrid,
          .workLogGrid {
            grid-template-columns: 1fr;
          }

          .desktopTable {
            display: none;
          }

          .mobileCards {
            display: block;
          }

          .headerCompact {
            align-items: flex-start;
            gap: 10px;
          }

          .headerCompactActions {
            width: 100%;
            justify-content: flex-start;
            gap: 5px;
          }

          .headerCompactActions a,
          .headerCompactActions button {
            width: auto;
            min-width: 0;
            flex: 0 0 auto;
            font-size: 11px;
          }

          .summaryStrip {
            flex-wrap: nowrap;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding: 8px 10px !important;
          }

          .ordersControlPanel {
            padding: 13px !important;
          }

          .ordersControlHeader h2 {
            font-size: 20px;
          }

          .ordersControlHeader p {
            font-size: 12px;
          }

          .ordersSection {
            padding: 10px;
          }

          .ordersSectionHeader {
            align-items: flex-start;
            padding: 9px 10px;
          }

          .orderRowSummary {
            padding: 9px;
            gap: 8px;
          }

          .orderRowMeta {
            width: 100%;
            gap: 6px;
          }

          .orderMetaChip {
            flex: 0 1 auto;
            min-width: 84px;
            min-height: 28px;
            padding: 4px 6px;
            border-radius: 8px;
          }

          .orderMetaLabel {
            font-size: 10px;
          }

          .mobileListCard {
            border-radius: 14px;
            padding: 12px;
            margin-bottom: 10px;
          }

          .mobileActionRow {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .calendarGrid {
            gap: 5px;
          }

          .calendarDay {
            min-height: 82px;
            padding: 5px;
            border-radius: 9px;
          }

          .calendarOrder {
            font-size: 10px;
            padding: 3px 4px;
          }

          .calendarPlanForm {
            grid-template-columns: 1fr;
          }

          .calendarTaskForm {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .headerCompactActions {
            overflow-x: auto;
            flex-wrap: nowrap;
            padding-bottom: 2px;
          }

          .headerCompactActions a,
          .headerCompactActions button {
            white-space: nowrap;
          }

          .orderMetaChip {
            flex: 1 1 calc(50% - 6px);
          }
        }
`}</style>
  )
}
