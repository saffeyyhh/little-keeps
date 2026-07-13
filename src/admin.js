<div style="
  margin:0;
  padding:24px 12px;
  background:#fff7fb;
  font-family:Arial,Helvetica,sans-serif;
  color:#332d30;
">

  <div style="
    max-width:600px;
    margin:0 auto;
    background:#ffffff;
    border:1px solid #f3dfe7;
    border-radius:20px;
    overflow:hidden;
  ">

    <!-- Header -->
    <div style="
      padding:28px 24px;
      text-align:center;
      background:#ffeaf2;
    ">
      <div style="
        color:#ff6799;
        font-size:26px;
        font-weight:bold;
      ">
        🩷 Little Keeps
      </div>

      <h1 style="
        margin:12px 0 6px;
        color:#332d30;
        font-size:23px;
        line-height:1.3;
      ">
        Your order is confirmed!
      </h1>

      <p style="
        margin:0;
        color:#756b70;
        font-size:14px;
      ">
        Payment verified successfully
      </p>
    </div>

    <!-- Main content -->
    <div style="padding:26px 24px;">

      <!-- Greeting -->
      <p style="
        margin:0 0 14px;
        font-size:16px;
        line-height:1.6;
      ">
        Hi <strong>{{customer_name}}</strong>,
      </p>

      <p style="
        margin:0 0 24px;
        color:#5f565a;
        font-size:15px;
        line-height:1.7;
      ">
        We’ve received your order and verified your payment.
        Thank you so much for supporting Little Keeps! 💕
      </p>

      <!-- Order reference -->
      <div style="
        padding:18px;
        margin-bottom:18px;
        background:#fff8fb;
        border:1px solid #f4dce6;
        border-radius:14px;
      ">
        <p style="
          margin:0 0 8px;
          color:#ff6799;
          font-size:13px;
          font-weight:bold;
          text-transform:uppercase;
          letter-spacing:0.6px;
        ">
          Order Reference
        </p>

        <p style="
          margin:0;
          color:#332d30;
          font-size:20px;
          font-weight:bold;
        ">
          {{order_ref}}
        </p>
      </div>

      <!-- Items ordered -->
<div style="
  padding:18px;
  margin-bottom:18px;
  border:1px solid #f0d8e2;
  border-radius:14px;
">

  <h2 style="
    margin:0 0 12px;
    color:#ff6799;
    font-size:18px;
  ">
    Your Order
  </h2>

  <div style="
    padding:14px;
    background:#fff8fb;
    border-radius:10px;
    color:#332d30;
    font-size:15px;
    line-height:2;
    white-space:pre-line;
  ">{{order_list}}</div>

</div>

      <!-- Order details -->
      <div style="
        padding:18px;
        margin-bottom:18px;
        background:#fff8fb;
        border-radius:14px;
      ">
        <h2 style="
          margin:0 0 12px;
          color:#ff6799;
          font-size:18px;
        ">
          Order Details
        </h2>

        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          style="
            color:#5f565a;
            font-size:14px;
          "
        >
          <tr>
            <td style="padding:7px 0;">
              Collection method
            </td>

            <td style="
              padding:7px 0;
              text-align:right;
              color:#332d30;
              font-weight:bold;
            ">
              {{collection_method}}
            </td>
          </tr>

          <tr>
            <td style="padding:7px 0;">
              Needed by
            </td>

            <td style="
              padding:7px 0;
              text-align:right;
              color:#332d30;
              font-weight:bold;
            ">
              {{needed_by}}
            </td>
          </tr>
        </table>
      </div>

      <!-- Payment summary -->
      <div style="
        padding:18px;
        margin-bottom:24px;
        border:1px solid #f0d8e2;
        border-radius:14px;
      ">
        <h2 style="
          margin:0 0 14px;
          color:#ff6799;
          font-size:18px;
        ">
          Payment Summary
        </h2>

        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          style="font-size:15px;"
        >
          <tr>
            <td style="
              padding:7px 0;
              color:#665d61;
            ">
              Subtotal
            </td>

            <td style="
              padding:7px 0;
              text-align:right;
              font-weight:bold;
            ">
              {{subtotal_amount}}
            </td>
          </tr>

          <tr>
            <td style="
              padding:7px 0;
              color:#665d61;
            ">
              Delivery
            </td>

            <td style="
              padding:7px 0;
              text-align:right;
              font-weight:bold;
            ">
              {{delivery_amount}}
            </td>
          </tr>

          <tr>
            <td
              colspan="2"
              style="
                padding-top:10px;
                border-top:1px solid #efd8e1;
              "
            ></td>
          </tr>

          <tr>
            <td style="
              padding:7px 0;
              font-size:17px;
              font-weight:bold;
            ">
              Total Paid
            </td>

            <td style="
              padding:7px 0;
              text-align:right;
              color:#ff6799;
              font-size:19px;
              font-weight:bold;
            ">
              {{total_amount}}
            </td>
          </tr>
        </table>
      </div>

      <!-- What's next -->
      <div style="
        padding:18px;
        background:#fff8fb;
        border-radius:14px;
      ">
        <h2 style="
          margin:0 0 12px;
          color:#ff6799;
          font-size:18px;
        ">
          📦 What’s Next?
        </h2>

        <p style="
          margin:0 0 9px;
          font-size:14px;
          line-height:1.6;
        ">
          ✨ Your personalised keychain will now enter production.
        </p>

        <p style="
          margin:0 0 9px;
          font-size:14px;
          line-height:1.6;
        ">
          🖨️ We’ll carefully print, assemble and quality-check every piece.
        </p>

        <p style="
          margin:0;
          font-size:14px;
          line-height:1.6;
        ">
          📧 We’ll contact you when your order is ready for collection or delivery.
        </p>
      </div>

    </div>

    <!-- Footer -->
    <div style="
      padding:22px 24px;
      text-align:center;
      background:#fff8fb;
      color:#8b8085;
      font-size:13px;
      line-height:1.6;
    ">
      Thank you for choosing<br>

      <strong style="color:#5f565a;">
        Little Keeps ♡
      </strong>

      <div style="margin-top:10px;">
        Made with lots of love and a little click. 🩷
      </div>
    </div>

  </div>
</div>