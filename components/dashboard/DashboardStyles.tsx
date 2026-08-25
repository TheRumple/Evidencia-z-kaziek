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

        .appShell {
          align-items: start;
          width: 100%;
          min-width: 0;
        }

        .sideMenu {
          position: sticky;
          top: 12px;
          min-height: calc(100vh - 24px);
          border-radius: 18px;
          padding: 16px;
          background:
            radial-gradient(circle at 20% 8%, rgba(132, 204, 22, 0.2), transparent 30%),
            linear-gradient(180deg, #07111f 0%, #0f172a 52%, #111827 100%);
          border: 1px solid rgba(148, 163, 184, 0.22);
          box-shadow: 0 24px 60px rgba(2, 6, 23, 0.28);
          color: #fff;
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-width: 0;
          max-width: 100%;
        }

        .sideMenuTitle {
          font-size: 16px;
          font-weight: 950;
          line-height: 1.1;
          color: #f8fafc;
        }

        .sideMenuSubTitle {
          margin-top: 4px;
          font-size: 12px;
          color: rgba(203, 213, 225, 0.72);
          font-weight: 800;
        }

        .sideMenuNav {
          display: grid;
          gap: 5px;
          min-width: 0;
          max-width: 100%;
        }

        .sideMenuFooter {
          margin-top: auto;
          display: grid;
          gap: 8px;
          border-top: 1px solid rgba(148, 163, 184, 0.18);
          padding-top: 12px;
          min-width: 0;
          max-width: 100%;
        }

        .portalRequestShortcut {
          display: none;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          min-height: 34px;
          border-radius: 10px;
          padding: 7px 9px;
          text-decoration: none;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(148, 163, 184, 0.18);
          color: #f8fafc;
          font-size: 12px;
          font-weight: 950;
        }

        .portalRequestShortcutAlert {
          background: rgba(239, 68, 68, 0.16);
          border-color: rgba(248, 113, 113, 0.5);
          color: #fee2e2;
        }

        .sideMenuBadge {
          min-width: 24px;
          height: 24px;
          padding: 0 7px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          font-size: 12px;
          font-weight: 950;
        }

        .sideMenuBadgeAlert {
          background: #ef4444;
          color: #fff;
          box-shadow: 0 0 0 5px rgba(239, 68, 68, 0.16);
        }

        .sideMenuIcon {
          color: rgba(203, 213, 225, 0.72);
          font-weight: 950;
        }

        .mainPanel {
          min-width: 0;
          max-width: 100%;
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
          grid-template-columns: minmax(260px, 1.8fr) minmax(180px, 1fr) minmax(150px, 0.8fr) minmax(180px, 1fr);
          gap: 8px;
          align-items: end;
        }

        .ordersWorkspace {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          align-items: start;
        }

        .ordersControlPanel {
          background: linear-gradient(135deg, #0b1120 0%, #182235 68%, #243b12 100%) !important;
          border: 1px solid rgba(148, 163, 184, 0.24) !important;
          color: #fff;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.16) !important;
          padding: 10px 12px !important;
        }

        .ordersControlHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }

        .ordersControlHeader h2 {
          margin: 0;
          color: #fff;
          font-size: 17px;
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
          margin-bottom: 3px;
        }

        .ordersVisibleBadge {
          border: 1px solid rgba(163, 230, 53, 0.45);
          background: rgba(132, 204, 22, 0.14);
          color: #ecfccb;
          border-radius: 999px;
          padding: 4px 9px;
          font-size: 13px;
          font-weight: 900;
          white-space: nowrap;
        }

        .ordersFilterField {
          display: grid;
          gap: 4px;
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
          min-height: 34px;
          border-radius: 10px !important;
          padding: 6px 10px !important;
          font-size: 12px !important;
        }

        .ordersControlPanel input::placeholder {
          color: rgba(203, 213, 225, 0.62);
        }

        .ordersBoard {
          padding: 0 !important;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.98) !important;
        }

        .ordersTableHead {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) 132px 170px 128px 102px;
          gap: 8px;
          align-items: center;
          padding: 6px 12px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          color: #64748b;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .ordersSectionStack {
          display: grid;
          gap: 0;
        }

        .ordersSection {
          padding: 0;
          border-top: 1px solid #e2e8f0;
        }

        .ordersSection:first-child {
          border-top: none;
        }

        .ordersSectionHeader {
          display: flex;
          justify-content: space-between;
          gap: 9px;
          align-items: center;
          margin: 0;
          border: none;
          background: #111827;
          border-radius: 0;
          padding: 4px 9px 4px 12px;
          color: #fff;
        }

        .ordersSectionHeader::before {
          content: '';
          align-self: stretch;
          width: 4px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.68);
          box-shadow: 0 0 18px rgba(255, 255, 255, 0.2);
        }

        .ordersSectionHeader > div:first-child {
          flex: 1;
          min-width: 0;
        }

        .ordersSectionHeader h3 {
          margin: 0;
          font-size: 11px;
          line-height: 1.1;
          font-weight: 900;
          color: #fff;
        }

        .ordersSectionHeader p {
          margin: 2px 0 0;
          color: rgba(226, 232, 240, 0.7);
          font-size: 9px;
          font-weight: 700;
        }

        .ordersSectionCount {
          min-width: 20px;
          height: 20px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.14);
          color: #f8fafc;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 10px;
        }

        .ordersSection-overdue .ordersSectionHeader {
          background: linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%);
        }

        .ordersSection-pinned .ordersSectionHeader,
        .ordersSection-pripnute .ordersSectionHeader {
          background: linear-gradient(135deg, #4d7c0f 0%, #365314 100%);
        }

        .ordersSection-rozpracovana .ordersSectionHeader {
          background: linear-gradient(135deg, #d97706 0%, #92400e 100%);
        }

        .ordersSection-cenova_ponuka .ordersSectionHeader {
          background: linear-gradient(135deg, #0e7490 0%, #075985 100%);
        }

        .ordersSection-obhliadka .ordersSectionHeader {
          background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
        }

        .ordersSection-caka .ordersSectionHeader {
          background: linear-gradient(135deg, #ea580c 0%, #9a3412 100%);
        }

        .ordersSection-nova .ordersSectionHeader {
          background: linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%);
        }

        .ordersSection-hotova .ordersSectionHeader {
          background: linear-gradient(135deg, #16a34a 0%, #166534 100%);
        }

        .ordersCardsStack {
          display: grid;
          gap: 0;
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
          border-radius: 0 !important;
          border-left-width: 4px !important;
          border-right: none !important;
          border-top: none !important;
          border-bottom: 1px solid #e2e8f0 !important;
          box-shadow: none !important;
          transition: background 0.18s ease, border-color 0.18s ease;
        }

        .orderCard:hover {
          transform: none;
          background: #f1f5f9 !important;
          box-shadow: none !important;
        }

        .orderCardExpanded {
          background: #fff !important;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.1) !important;
        }

        .orderCardTitle {
          font-weight: 900;
          font-size: 13px;
          line-height: 1.12;
          color: #0f172a;
          overflow-wrap: anywhere;
        }

        .orderCardCustomer {
          margin-top: 2px;
          color: #475569;
          font-size: 11px;
          font-weight: 800;
        }

        .orderCardCustomerInline {
          display: none;
        }

        .orderRowCustomerCell {
          min-width: 0;
          color: #334155;
          font-size: 11px;
          font-weight: 850;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .orderProgressCell {
          display: grid;
          grid-template-columns: 20px minmax(58px, 1fr) 31px 20px;
          gap: 4px;
          align-items: center;
          min-width: 0;
        }

        .orderProgressMini {
          height: 7px;
          border-radius: 999px;
          background: #e2e8f0;
          overflow: hidden;
          box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.1);
        }

        .orderProgressMini span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #84cc16, #16a34a);
        }

        .orderProgressValue {
          color: #334155;
          font-size: 10px;
          font-weight: 900;
          text-align: right;
          white-space: nowrap;
        }

        .orderProgressEmpty {
          grid-column: 1 / -1;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 900;
          text-align: center;
        }

        .orderProgressButton {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          background: #fff;
          color: #0f172a;
          font-size: 12px;
          font-weight: 900;
          line-height: 1;
          cursor: pointer;
          padding: 0;
        }

        .orderProgressButton:disabled {
          opacity: 0.35;
          cursor: not-allowed;
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

        .deliveryProtocolItemRow {
          grid-template-columns: minmax(180px, 1.5fr) minmax(130px, 1fr) 70px minmax(150px, 1.1fr) 38px;
        }

        .orderRowSummary {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) 132px 170px 238px;
          align-items: center;
          gap: 7px;
          padding: 4px 9px;
          min-height: 44px;
        }

        .orderRowMeta {
          display: flex;
          align-items: center;
          gap: 5px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .orderMetaChip {
          min-width: 58px;
          min-height: 25px;
          padding: 3px 6px;
          border-radius: 7px;
          border: 1px solid #e2e8f0;
          background: #fff;
          display: inline-flex;
          align-items: flex-start;
          justify-content: center;
          flex-direction: column;
          gap: 1px;
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.04);
        }

        .orderMetaChip strong {
          white-space: nowrap;
          line-height: 1;
          font-size: 12px;
        }

        .orderMetaLabel {
          font-size: 8px;
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

        .workPlannerHero {
          padding: 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          background: linear-gradient(135deg, #0f172a 0%, #172033 52%, #18330f 100%) !important;
          border-color: rgba(132, 204, 22, 0.25) !important;
          color: #fff;
        }

        .workPlannerHero h2,
        .workPlannerForm h3,
        .workPlannerSidebarList h3,
        .workPlannerDayTitle h3 {
          margin: 0;
          color: inherit;
          font-weight: 900;
          letter-spacing: 0;
        }

        .workPlannerHero h2 {
          font-size: 28px;
        }

        .workPlannerHero p {
          margin: 6px 0 0;
          max-width: 760px;
          color: rgba(255, 255, 255, 0.76);
          font-size: 14px;
        }

        .workPlannerHeroActions,
        .workPlannerActionRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .workPlannerToolbar {
          padding: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .workPlannerMode {
          display: flex;
          gap: 6px;
          padding: 4px;
          border: 1px solid #dbe4ef;
          border-radius: 12px;
          background: #f8fafc;
        }

        .workPlannerMode button {
          border: 0;
          border-radius: 9px;
          padding: 8px 12px;
          background: transparent;
          color: #475569;
          font-weight: 900;
          cursor: pointer;
        }

        .workPlannerMode button.active {
          background: #0f172a;
          color: #fff;
        }

        .workPlannerStats {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
          color: #475569;
          font-size: 13px;
          font-weight: 800;
        }

        .workPlannerStats span {
          border: 1px solid #dbe4ef;
          border-radius: 999px;
          padding: 7px 10px;
          background: #fff;
        }

        .workPlannerLayout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 12px;
          align-items: start;
        }

        .workPlannerBoard,
        .workPlannerForm,
        .workPlannerSidebarList {
          padding: 12px;
        }

        .workPlannerWeek {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 8px;
        }

        .workPlannerDay {
          min-height: 560px;
          border: 1px solid #dbe4ef;
          border-radius: 12px;
          padding: 8px;
          background: #fff;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          gap: 8px;
          cursor: pointer;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
        }

        .workPlannerDay:hover,
        .workPlannerDay.selected {
          border-color: #84cc16;
          box-shadow: 0 10px 26px rgba(15, 23, 42, 0.08);
        }

        .workPlannerDay.today {
          background: linear-gradient(180deg, #f7fee7 0%, #fff 42%);
        }

        .workPlannerDay.weekend {
          background: linear-gradient(180deg, #f8fafc 0%, #fff 42%);
        }

        .workPlannerDay.dragOver {
          border-color: #65a30d;
          box-shadow: inset 0 0 0 2px rgba(132, 204, 22, 0.45);
        }

        .workPlannerDayHeader {
          display: grid;
          grid-template-columns: 1fr auto auto;
          align-items: center;
          gap: 6px;
          color: #64748b;
          font-weight: 900;
          font-size: 12px;
        }

        .workPlannerDayHeader strong {
          color: #0f172a;
          font-size: 18px;
        }

        .workPlannerDayHeader em {
          min-width: 24px;
          height: 24px;
          border-radius: 999px;
          display: inline-grid;
          place-items: center;
          background: #0f172a;
          color: #fff;
          font-style: normal;
          font-size: 12px;
        }

        .workPlannerDayItems,
        .workPlannerDetailList,
        .workPlannerOrderList {
          display: grid;
          gap: 7px;
          align-content: start;
        }

        .workPlannerItem {
          min-width: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 24px;
          gap: 4px;
          border: 1px solid #dbe4ef;
          border-left: 4px solid #84cc16;
          border-radius: 10px;
          padding: 5px;
          cursor: grab;
          align-items: stretch;
        }

        .workPlannerItemMain {
          min-width: 0;
          border: 0;
          background: transparent;
          padding: 0;
          text-align: left;
          display: grid;
          gap: 2px;
          cursor: pointer;
          align-content: start;
        }

        .workPlannerItemMain span {
          font-size: 10px;
          line-height: 1;
          font-weight: 900;
          text-transform: uppercase;
        }

        .workPlannerItemMain b {
          justify-self: start;
          border-radius: 999px;
          padding: 3px 7px;
          font-size: 10px;
          line-height: 1;
          font-weight: 900;
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.14);
        }

        .workPlannerItemMain strong {
          min-width: 0;
          color: #0f172a;
          font-size: 13px;
          line-height: 1.15;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .workPlannerItemMain em,
        .workPlannerItemMain small {
          min-width: 0;
          color: #64748b;
          font-style: normal;
          font-size: 11px;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .workPlannerDelete {
          border: 1px solid #fecaca;
          background: rgba(255, 241, 242, 0.86);
          color: #be123c;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 900;
          line-height: 1;
        }

        .workPlannerEmpty,
        .workPlannerNoData {
          color: #94a3b8;
          font-weight: 800;
          font-size: 13px;
        }

        .workPlannerSide {
          display: grid;
          gap: 12px;
        }

        .workPlannerForm,
        .workPlannerSidebarList {
          display: grid;
          gap: 12px;
        }

        .workPlannerFormGrid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
        }

        .workPlannerTextarea {
          min-height: 92px;
          resize: vertical;
        }

        .workPlannerSideHeader,
        .workPlannerDayTitle {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .workPlannerSideHeader span {
          min-width: 32px;
          height: 32px;
          border-radius: 999px;
          display: inline-grid;
          place-items: center;
          background: #ecfccb;
          color: #365314;
          font-weight: 900;
        }

        .workPlannerOrder {
          border: 1px solid #dbe4ef;
          background: #fff;
          border-radius: 12px;
          padding: 9px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 4px 8px;
          text-align: left;
          cursor: grab;
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.04);
        }

        .workPlannerOrder strong {
          min-width: 0;
          color: #0f172a;
          font-size: 13px;
          font-weight: 900;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .workPlannerOrder span {
          grid-column: 1;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .workPlannerOrder em {
          grid-column: 2;
          grid-row: 1 / span 2;
          align-self: center;
          border-radius: 999px;
          padding: 4px 7px;
          font-style: normal;
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
        }

        .workPlannerDayDetail,
        .workPlannerUnplannedWide {
          display: grid;
          gap: 12px;
        }

        @media (max-width: 1150px) {
          .summaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ordersWorkspace {
            grid-template-columns: 1fr;
          }

          .filtersGridOrders {
            grid-template-columns: 1fr 1fr;
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

          .workPlannerHero,
          .workPlannerToolbar,
          .workPlannerDayTitle {
            align-items: stretch;
            flex-direction: column;
          }

          .workPlannerHeroActions,
          .workPlannerStats,
          .workPlannerActionRow {
            justify-content: flex-start;
          }

          .workPlannerLayout {
            grid-template-columns: 1fr;
          }

          .workPlannerWeek {
            grid-template-columns: 1fr;
          }

          .workPlannerDay {
            min-height: 130px;
          }

          .workPlannerFormGrid {
            grid-template-columns: 1fr 1fr;
          }

          .orderDetailGrid {
            grid-template-columns: 1fr;
          }

          .orderRowSummary {
            grid-template-columns: 1fr;
            align-items: stretch;
          }

          .orderRowCustomerCell {
            display: none;
          }

          .orderCardCustomerInline {
            display: block;
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

          .sideMenu {
            position: static;
            min-height: 0;
          }

          .sideMenuNav {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .sideMenuFooter {
            margin-top: 0;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          body {
            overflow-x: hidden;
          }

          .layoutWrap,
          .appShell,
          .mainPanel,
          .sideMenu {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            box-sizing: border-box;
          }

          .filtersGrid,
          .filtersGridOrders,
          .modalGrid,
          .summaryGrid,
          .workLogGrid,
          .deliveryProtocolItemRow {
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
            gap: 6px;
          }

          .headerCompactActions {
            display: none;
          }

          .headerCompactActions a,
          .headerCompactActions button {
            width: auto;
            min-width: 0;
            flex: 0 0 auto;
            font-size: 11px;
          }

          .sideMenu {
            border-radius: 14px;
            padding: 9px;
            gap: 8px;
          }

          .sideMenu > div:first-child {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .sideMenu > div:first-child > div:first-child {
            margin-bottom: 0 !important;
          }

          .sideMenu > div:first-child span:first-child {
            width: 92px !important;
            height: 30px !important;
            border-radius: 8px !important;
          }

          .sideMenuTitle {
            font-size: 13px;
          }

          .sideMenuSubTitle {
            display: none;
          }

          .portalRequestShortcut {
            display: flex;
          }

          .sideMenuNav {
            display: flex;
            gap: 6px;
            overflow-x: auto;
            overflow-y: hidden;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            padding-bottom: 1px;
            -webkit-overflow-scrolling: touch;
          }

          .sideMenuNav a,
          .sideMenuNav button {
            width: auto !important;
            min-width: 106px;
            min-height: 34px !important;
            flex: 0 0 auto;
            padding: 7px 8px !important;
            font-size: 12px !important;
            border-radius: 9px !important;
          }

          .sideMenuFooter {
            display: flex;
            gap: 6px;
            overflow-x: auto;
            overflow-y: hidden;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            padding-top: 7px;
            -webkit-overflow-scrolling: touch;
          }

          .sideMenuFooter button {
            width: auto !important;
            min-width: 118px;
            min-height: 34px !important;
            flex: 0 0 auto;
            padding: 7px 8px !important;
            font-size: 12px !important;
            border-radius: 9px !important;
            box-shadow: none !important;
          }

          .sideMenuFooter button:not(:first-child) {
            display: none !important;
          }

          .sideMenuBadge {
            min-width: 20px;
            height: 20px;
            padding: 0 6px;
            font-size: 11px;
          }

          .summaryStrip {
            flex-wrap: nowrap;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding: 8px 10px !important;
          }

          .ordersControlPanel {
            padding: 10px !important;
            border-radius: 12px !important;
            max-width: 100%;
            overflow: hidden;
          }

          .ordersTableHead {
            display: none;
          }

          .ordersControlHeader h2 {
            font-size: 18px;
          }

          .ordersControlHeader p {
            font-size: 11px;
          }

          .ordersEyebrow {
            font-size: 10px;
            margin-bottom: 4px;
          }

          .ordersVisibleBadge {
            padding: 5px 8px;
            font-size: 11px;
          }

          .ordersSection {
            padding: 8px;
          }

          .ordersSectionHeader {
            align-items: flex-start;
            padding: 8px 9px;
            border-radius: 11px;
            margin-bottom: 8px;
          }

          .orderCard {
            border-radius: 12px !important;
            border-right: 1px solid #e2e8f0 !important;
            border-top: 1px solid #e2e8f0 !important;
            border-bottom: 1px solid #e2e8f0 !important;
            box-shadow: 0 7px 18px rgba(15, 23, 42, 0.06) !important;
          }

          .ordersCardsStack {
            gap: 8px;
          }

          .orderRowSummary {
            padding: 8px;
            gap: 6px;
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
            border-radius: 12px;
            padding: 10px;
            margin-bottom: 8px;
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

          .workPlannerHero {
            padding: 14px;
          }

          .workPlannerHero h2 {
            font-size: 22px;
          }

          .workPlannerMode {
            width: 100%;
            overflow-x: auto;
          }

          .workPlannerMode button {
            white-space: nowrap;
          }

          .workPlannerStats span {
            font-size: 12px;
            padding: 6px 8px;
          }

          .workPlannerFormGrid {
            grid-template-columns: 1fr;
          }

          .workPlannerOrder {
            grid-template-columns: minmax(0, 1fr);
          }

          .workPlannerOrder em {
            grid-column: 1;
            grid-row: auto;
            justify-self: start;
          }
        }

        @media (max-width: 520px) {
          .layoutWrap {
            gap: 8px !important;
          }

          .headerCompactActions {
            overflow-x: auto;
            flex-wrap: nowrap;
            padding-bottom: 2px;
          }

          .headerCompactActions a,
          .headerCompactActions button {
            white-space: nowrap;
          }

          .headerCompact h1 {
            font-size: 19px !important;
          }

          .headerCompact > div:first-child > div {
            font-size: 11px !important;
          }

          .orderMetaChip {
            flex: 1 1 calc(50% - 6px);
          }
        }
`}</style>
  )
}
