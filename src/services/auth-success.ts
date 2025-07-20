// Auth success HTML template
export const AUTH_SUCCESS_HTML = `<html encoding="UTF-8">
  <head>
    <title>AgentLISA Authentication Complete</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600&display=swap"
      rel="stylesheet"
    />
  </head>
  <body
    style="
      font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI',
        Roboto, sans-serif;
      text-align: center;
      padding: 50px;
      background: #fff;
      color: #000;
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    "
  >
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 1640 1024"
      fill="none"
      style="
        position: absolute;
        top: 0;
        left: 0;
        z-index: -1;
        object-fit: cover;
        min-width: 100%;
        min-height: 100%;
        opacity: 0.5;
      "
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g opacity="0.5" clip-path="url(#clip0_1509_78)">
        <rect width="1640" height="1024" fill="white" />
        <g filter="url(#filter0_f_1509_78)">
          <circle cx="1020" cy="1090" r="399" fill="#E7B4FF" />
        </g>
        <g filter="url(#filter1_f_1509_78)">
          <ellipse
            cx="429.329"
            cy="914.9"
            rx="456.027"
            ry="111.155"
            transform="rotate(-21.8751 429.329 914.9)"
            fill="url(#paint0_linear_1509_78)"
          />
        </g>
        <g filter="url(#filter2_f_1509_78)">
          <ellipse
            cx="410.32"
            cy="369.965"
            rx="815.557"
            ry="347.033"
            transform="rotate(-23.1731 410.32 369.965)"
            fill="#E7FFFA"
          />
        </g>
        <g filter="url(#filter3_f_1509_78)">
          <circle cx="202.5" cy="44.5" r="314.5" fill="#55FFEA" />
        </g>
      </g>
      <defs>
        <filter
          id="filter0_f_1509_78"
          x="221"
          y="291"
          width="1598"
          height="1598"
          filterUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
        >
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="BackgroundImageFix"
            result="shape"
          />
          <feGaussianBlur
            stdDeviation="200"
            result="effect1_foregroundBlur_1509_78"
          />
        </filter>
        <filter
          id="filter1_f_1509_78"
          x="-395.916"
          y="316.102"
          width="1650.49"
          height="1197.6"
          filterUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
        >
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="BackgroundImageFix"
            result="shape"
          />
          <feGaussianBlur
            stdDeviation="200"
            result="effect1_foregroundBlur_1509_78"
          />
        </filter>
        <filter
          id="filter2_f_1509_78"
          x="-751.906"
          y="-482.561"
          width="2324.45"
          height="1705.05"
          filterUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
        >
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="BackgroundImageFix"
            result="shape"
          />
          <feGaussianBlur
            stdDeviation="200"
            result="effect1_foregroundBlur_1509_78"
          />
        </filter>
        <filter
          id="filter3_f_1509_78"
          x="-412"
          y="-570"
          width="1229"
          height="1229"
          filterUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
        >
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="BackgroundImageFix"
            result="shape"
          />
          <feGaussianBlur
            stdDeviation="150"
            result="effect1_foregroundBlur_1509_78"
          />
        </filter>
        <linearGradient
          id="paint0_linear_1509_78"
          x1="-53.8568"
          y1="865.124"
          x2="786.172"
          y2="929.622"
          gradientUnits="userSpaceOnUse"
        >
          <stop stop-color="#00A6FF" />
          <stop offset="1" stop-color="#48FFBF" />
        </linearGradient>
        <clipPath id="clip0_1509_78">
          <rect width="1640" height="1024" fill="white" />
        </clipPath>
      </defs>
    </svg>
    <div>
      <img
        src="https://agentlisa.ai/images/logo.png"
        alt="AgentLISA"
        style="
          width: 120px;
          height: auto;
          margin-bottom: 20px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        "
      />
      <h2 style="color: #14b8a6; margin-bottom: 15px; font-weight: 500">
        Authentication Successful!
      </h2>
      <p style="font-size: 1.2em; color: #000">
        You can close this window and return to VS Code.
      </p>
      <p style="font-size: 0.9em; color: #a3a3a3; margin-top: 30px">
        This window will close automatically in 3 seconds...
      </p>
    </div>
    <script>
      // setTimeout(() => window.close(), 3000);
    </script>
  </body>
</html>`;