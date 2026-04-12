type Props = {
  title: string;
  subtitle: string;
};

export default function SectionHeader({ title, subtitle }: Props) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-medium text-slate-900 dark:text-white">{title}</h1>
      <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
  );
}
