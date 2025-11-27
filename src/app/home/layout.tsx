import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Podcast to Insight',
  description: '播客转写、总结与跨播客 QA - 将播客内容转化为深度洞察',
  openGraph: {
    title: 'Podcast to Insight',
    description: '播客转写、总结与跨播客 QA - 将播客内容转化为深度洞察',
    type: 'website',
    siteName: 'Podcast to Insight',
    locale: 'zh_CN',
  },
  twitter: {
    card: 'summary',
    title: 'Podcast to Insight',
    description: '播客转写、总结与跨播客 QA - 将播客内容转化为深度洞察',
  },
};

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

