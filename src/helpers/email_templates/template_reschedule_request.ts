type EmailWords = {
  Fair_short_name: string;
  Requester_name: string;
  Requester_company_name: string;
  Fair_long_name_EN: string;
  Fair_long_name_TC: string;
  Responder_name: string;
  Meeting_date: string;
  Meeting_time: string;
  Cancel_Original_Meeting_hour: string;
  Link_PendingAccept_EN: string;
};

export const writeEmail_reschedule = function (emailWords:EmailWords):string {
  return `
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
          @media only screen and (max-width: 600px) {
              .paper {
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
              }
          }
          
          .button {
              background-color: #fb5004;
              height: 39px;
              width: 130px;
              left: 382px;
              top: 608px;
              border: none;
              border-radius: 90px;
              color: white;
              padding: 5px 7px;
              font-size: 14px;
              text-align: center;
              text-decoration: none;
              cursor: pointer;
          }
          
          .contentMargin {
              height: 757px;
              width: 600px;
              left: 342px;
              top: 287px;
              border-radius: 0px;
              margin-left: 43px;
          }
          
          .contentPadding {
              margin: 30px 0px;
          }
      </style>
    </head>
    <body>
      <div class="contentMargin">
          <div style="padding-left: 42; padding-top: 36;">
              <img src="https://i.ibb.co/k6zpjcV/dummy-Fair-Logo.png">
              <div style="font-weight:bold;">${emailWords.Fair_long_name_EN}</div>
              <div style="font-weight:bold;">${emailWords.Fair_long_name_TC}</div>
          </div>
          <div style="padding-top: 30px;">Dear ${emailWords.Responder_name},</div>
          <div class="contentPadding">You have a meeting rescheduling request at ${emailWords.Fair_short_name} via Click2Match. Here are the details:</div>
          <div class="contentPadding">Person: ${emailWords.Requester_name} - ${emailWords.Requester_company_name}</div>
          <div>Meeting Date/Time: DD/MM/YYYY ${emailWords.Meeting_date} at [HH:MM] ${emailWords.Meeting_time}(UTC/GMT+8)</div>
          <div class="contentPadding">Please click <a href=${emailWords.Link_PendingAccept_EN}>HERE</a> to confirm your meeting.</div>
          <div class="contentPadding">Note: If you do not make any responses in the upcoming ${emailWords.Cancel_Original_Meeting_hour} hours, your meeting will be cancelled by system automatically.</div>
          <div class="contentPadding">Thank you and Happy Networking!</div>
          <div class="contentPadding">Best regards,</div>
          <div>Hong Kong Trade Development Council</div>
          <div class="contentPadding">This is a system-generated email, please do not reply to this message.</div>
      </div>
    </body>
    </html>
    `;
};
