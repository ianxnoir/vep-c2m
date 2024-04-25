export const config = {
  db: {
    type: 'mariadb',
    synchronize: false,
    autoLoadEntities: true,
    logging: true,
    timezone: 'Z',
    host: process.env.DB_HOST || 'vepdev-c2m-db.cmt9d5oe5goe.ap-east-1.rds.amazonaws.com',
    port: process.env.DB_PORT || 3306,
    username: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'vep_c2m_service_db',
    extra: {
      connectionLimit: 10,
    },
  },
  api: {
    EXHIBITOR_SERVICE_URI: process.env.EXHIBITOR_SERVICE_URI || 'http://internal-vep-dev-alb-backendApp-1895655741.ap-east-1.elb.amazonaws.com:1082',
    CONTENT_SERVICE_URI: process.env.CONTENT_SERVICE_URI || 'http://internal-vep-dev-alb-backendApp-1895655741.ap-east-1.elb.amazonaws.com:1083',
    FAIR_SERVICE_URI: process.env.FAIR_SERVICE_URI || 'http://internal-vep-dev-alb-backendApp-1895655741.ap-east-1.elb.amazonaws.com:1085',
    WEBSOCKET_URI: process.env.WEBSOCKET_URI || 'https://vep-c2m-ws-clouddev.origin-aws-vep-nonprd.hktdc.com',
    NOTIFICATION_SERVICE_URI: process.env.NOTIFICATION_SERVICE_URI || 'http://internal-vep-dev-alb-backendApp-1895655741.ap-east-1.elb.amazonaws.com:1088',
    BUYER_SERVICE_URI: process.env.BUYER_SERVICE_URI || 'http://internal-vep-dev-alb-backendApp-1895655741.ap-east-1.elb.amazonaws.com:1086',
    // using uat domain for dev / sit / uat / preprd
    EMP_SERVICE_URI: process.env.EMP_SERVICE_URI || 'https://api-emp2-internal-uat.origin-aws.hktdc.com',
    BMAI_SERVICE: {
      URI: process.env.BMAI_SERVICE_URI || 'https://api-bmai-internal-uat.hktdc.com',
      X_API_KEY: process.env.BMAI_SERVICE_X_API_KEY
    },
    LAMBDA_URI: process.env.LAMBDA_URI || 'https://api-vep-c2m-internal-dev.origin-aws-vep-nonprd.hktdc.com'
  },
  apiVersion: {
    EMP_SERVICE: process.env.API_VERSION_EMP_SERVICE || 'v1'
  },
  settings: {
    meeting_ready_before: 15,
    trtc_expire: process.env.TRTC_EXPIRE || 604800,
  },
  content: {
    host: process.env.CONTENT_DB_HOST || 'vepdev-content-db.cmt9d5oe5goe.ap-east-1.rds.amazonaws.com',
    port: process.env.CONTENT_DB_PORT || 3306,
    username: process.env.CONTENT_DB_USER || 'admin',
    password: process.env.CONTENT_DB_PASSWORD,
    buyerDatabase: process.env.BUYER_DB_DATABASE || 'vepBuyerDb',
    c2mDatabase: process.env.C2M_DB_DATABASE || 'vep_c2m_service_db',
    contentDatabase: process.env.CONTENT_DB_DATABASE || 'vep_content',
    exhibitorDatabase: process.env.EXHIBITOR_DB_DATABASE || 'vepExhibitorDb',
    fairDatabase: process.env.FAIR_DB_DATABASE || 'vepFairDb',
  },
  exhibitor: {
    host: process.env.EXHIBITOR_DB_HOST,
    port: process.env.EXHIBITOR_DB_PORT,
    username: process.env.EXHIBITOR_DB_USER,
    password: process.env.EXHIBITOR_DB_PASSWORD ,
    database: process.env.EXHIBITOR_DB_DATABASE,
  },
  fair: {
    host: process.env.FAIR_DB_HOST,
    port: process.env.FAIR_DB_PORT,
    username: process.env.FAIR_DB_USER,
    password: process.env.FAIR_DB_PASSWORD,
    database: process.env.FAIR_DB_DATABASE,
  },
  vepSite: {
    domain: process.env.VEP_SITE_DOMAIN || 'https://vep-tradeshow-dev.hktdc.com/',
  },
  notification: {
    emailQueueUrlStandard: process.env.EMAIL_QUEUE_STANDARD || 'https://sqs.ap-east-1.amazonaws.com/133924639765/vep-dev-sqs-notification-email-standard.fifo',
    emailQueueUrlFast: process.env.EMAIL_QUEUE_FAST || 'https://sqs.ap-east-1.amazonaws.com/133924639765/vep-dev-sqs-notification-email-fast.fifo',
    webQueueUrlStandard: process.env.WEB_QUEUE_STANDARD || 'https://sqs.ap-east-1.amazonaws.com/133924639765/vep-dev-sqs-notification-web-standard.fifo',
    webQueueUrlFast: process.env.WEB_QUEUE_FAST || 'https://sqs.ap-east-1.amazonaws.com/133924639765/vep-dev-sqs-notification-web-fast.fifo',
    from: process.env.EMAIL_FROM || 'no-reply@hktdc.com',
  },
  quota: {
    sendbird: process.env.SENDBIRD_QUOTA || 2000
  },
  trtc: {
    secretArn: process.env.TRTC_SECRET_ARN
  },
  admin: {
    ADMIN_JWT_PUBLIC_KEY: '',
    ADMIN_JWT_PUBLIC_KEY_RS256:'',
  },
};
