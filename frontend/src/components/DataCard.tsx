interface DataCardProps {
    title: string;
    value: string | number;
    unit?: string;
    description?: string;
    trend?: 'up' | 'down' | 'neutral';
    color?: string;
    className?: string;
}

export function DataCard({ 
    title, 
    value, 
    unit, 
    description, 
    trend, 
    color = 'text-gray-900 dark:text-white',
    className = '' 
}: DataCardProps) {
    const getTrendIcon = () => {
        if (!trend) return null;
        
        const commonClasses = "w-4 h-4 ml-2";
        
        switch (trend) {
            case 'up':
                return (
                    <svg className={`${commonClasses} text-green-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                );
            case 'down':
                return (
                    <svg className={`${commonClasses} text-red-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
                    </svg>
                );
            case 'neutral':
                return (
                    <svg className={`${commonClasses} text-gray-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
                    </svg>
                );
        }
    };

    return (
        <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 ${className}`}>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {title}
            </h3>
            <div className="mt-2 flex items-baseline">
                <span className={`text-3xl font-semibold ${color}`}>
                    {value}
                </span>
                {unit && (
                    <span className="ml-1 text-sm text-gray-500 dark:text-gray-400">
                        {unit}
                    </span>
                )}
                {getTrendIcon()}
            </div>
            {description && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {description}
                </p>
            )}
        </div>
    );
}
