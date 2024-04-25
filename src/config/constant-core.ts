export const constant = {
  eventCode: {
    'vep-foundation': {
      codeDomain: 'E00',
      codeService: {
        core: '001',
      },
    },
    'vep-content': {
      codeDomain: 'E01',
    },
    'vep-buyer': {
      codeDomain: 'E02',
    },
    'vep-exhibitor': {
      codeDomain: 'E03',
    },
    'vep-eFloorplan': {
      codeDomain: 'E04',
    },
    'vep-appointment': {
      codeDomain: 'E05',
    },
    'vep-notification': {
      codeDomain: 'E06',
    },
    'vep-fair': {
      codeDomain: 'E07',
    },
    'vep-c2m': {
      codeDomain: 'E08',
      codeService: {
        service: '001',
      },
    },
  },
  codeMapper: {
    http_request_received: '00001',
    http_response_sent: '00002',
    api_call: '00003',
    exception_raised: '00004',
  },
};
