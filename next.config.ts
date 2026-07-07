import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true
  },
  async redirects() {
    return [
      { source: '/cfb-schedule.html', destination: '/cfb-schedule', permanent: true },
      { source: '/cfb-schedule-react.html', destination: '/cfb-schedule', permanent: true }
    ];
  }
};

export default nextConfig;
