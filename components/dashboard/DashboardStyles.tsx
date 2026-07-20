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
          padding: 10px 12px;
        }

        .orderRowMeta {
          display: grid;
          grid-template-columns: repeat(5, auto);
          align-items: center;
          gap: 8px;
          justify-content: flex-end;
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

        @media (max-width: 1150px) {
          .summaryGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
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

          .orderRowSummary {
            padding: 7px;
            gap: 5px;
          }

          .orderRowMeta {
            width: 100%;
            gap: 6px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
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
