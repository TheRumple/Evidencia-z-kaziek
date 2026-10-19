# ITspot warehouse import

The warehouse imports UTF-8 JSON with this structure:

```json
{
  "version": 1,
  "batch_name": "2026-10",
  "documents": [
    {
      "supplier_name": "Supplier, s.r.o.",
      "invoice_number": "FV2026001",
      "invoice_date": "2026-10-19",
      "source_file": "invoice.pdf",
      "movement_purpose": "stock",
      "lines": [
        {
          "name": "Dahua 4 Mpx IP camera",
          "sku": "IPC-XXXX",
          "category": "Cameras",
          "quantity": 2,
          "unit": "ks",
          "unit_price_net": 120.5,
          "vat_rate": 23,
          "destination": "stock",
          "customer_name": "",
          "note": ""
        }
      ]
    }
  ]
}
```

For stock carried over from the previous year, set `movement_purpose` to `opening` on the document or an individual line. The movement will be shown as `Počiatočný stav` instead of a regular purchase receipt.

## Destinations

- `stock`: keep the quantity in stock.
- `customer`: receive and immediately issue it as a sale to a customer.
- `job`: receive and immediately issue it to a job/order.
- `internal`: receive and immediately issue it for internal company consumption.
- `ignore`: do not create a stock card or movement (services, shipping, discounts).

The review table in the app is authoritative. The user confirms quantities, prices, destination, customer, and job before posting the batch.
