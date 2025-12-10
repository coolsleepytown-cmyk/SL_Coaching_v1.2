import React, { useState } from 'react';
import { Scenario, DevelopmentLevel } from '../types';
import { Button } from './Button';

interface ScenarioSelectorProps {
  scenarios: Scenario[];
  onSelect: (scenario: Scenario) => void;
  isLoading: boolean;
  onRefresh: (industry?: string, role?: string) => void;
  onShare: (scenario: Scenario) => void;
}

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({ 
  scenarios, 
  onSelect, 
  isLoading, 
  onRefresh,
  onShare 
}) => {
  const [industry, setIndustry] = useState('');
  const [role, setRole] = useState('');

  const getBadgeColor = (level: DevelopmentLevel) => {
    switch (level) {
      case DevelopmentLevel.D1: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case DevelopmentLevel.D2: return 'bg-orange-100 text-orange-800 border-orange-200';
      case DevelopmentLevel.D3: return 'bg-blue-100 text-blue-800 border-blue-200';
      case DevelopmentLevel.D4: return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLevelLabel = (level: DevelopmentLevel) => {
    switch (level) {
      case DevelopmentLevel.D1: return 'D1: 열정적인 초심자';
      case DevelopmentLevel.D2: return 'D2: 좌절한 학습자';
      case DevelopmentLevel.D3: return 'D3: 소극적인 수행자';
      case DevelopmentLevel.D4: return 'D4: 자주적 성취자';
      default: return level;
    }
  };

  const handleCustomGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    onRefresh(industry, role);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">코칭 시나리오 선택</h2>
        <p className="text-slate-600 max-w-2xl mx-auto mb-8">
          라임웍스가 생성한 리더십 상황입니다. 해결하고 싶은 상황을 선택하여 
          코칭 피드백을 연습해 보세요
        </p>

        {/* Custom Scenario Settings */}
        <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
           <form onSubmit={handleCustomGenerate} className="flex flex-col md:flex-row gap-4 items-end">
             <div className="flex-1 w-full text-left">
               <label className="block text-sm font-medium text-slate-700 mb-1">산업군 (Industry)</label>
               <input 
                 type="text" 
                 value={industry}
                 onChange={(e) => setIndustry(e.target.value)}
                 placeholder="예: IT 스타트업, 자동차 제조업, 병원" 
                 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
               />
             </div>
             <div className="flex-1 w-full text-left">
               <label className="block text-sm font-medium text-slate-700 mb-1">직무 (Job Role)</label>
               <input 
                 type="text" 
                 value={role}
                 onChange={(e) => setRole(e.target.value)}
                 placeholder="예: 영업 사원, 백엔드 개발자, 간호사" 
                 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
               />
             </div>
             <Button 
               type="submit" 
               variant="primary" 
               className="w-full md:w-auto min-w-[120px] h-[42px]"
               isLoading={isLoading}
             >
                {isLoading ? '생성 중...' : '맞춤 생성'}
             </Button>
           </form>
           <div className="mt-2 text-xs text-slate-400 text-left">
              * 입력하지 않으면 랜덤한 산업군과 직무로 시나리오가 생성됩니다.
           </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 animate-pulse">
            {industry ? `${industry} 분야의 ` : ''}새로운 시나리오를 생성 중입니다...
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-fade-in-up">
          {scenarios.map((scenario) => (
            <div 
              key={scenario.id} 
              className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex flex-col h-full overflow-hidden group relative"
            >
              <div className="p-1 bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-100 flex justify-between items-center px-4 py-3">
                 <span className={`text-xs font-bold px-2 py-1 rounded border ${getBadgeColor(scenario.developmentLevel)}`}>
                    {getLevelLabel(scenario.developmentLevel)}
                 </span>
                 <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onShare(scenario);
                    }}
                    className="text-slate-400 hover:text-indigo-600 p-1 rounded-full hover:bg-indigo-50 transition-colors"
                    title="링크 복사하여 공유하기"
                 >
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                 </button>
              </div>
              <div className="p-6 flex-1 flex flex-col" onClick={() => onSelect(scenario)}>
                <h3 className="font-bold text-lg text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">
                  {scenario.title}
                </h3>
                <div className="flex items-center text-sm text-slate-500 mb-4">
                  <span className="font-medium bg-slate-100 px-2 py-0.5 rounded mr-2">{scenario.employeeName}</span>
                  <span>{scenario.employeeRole}</span>
                </div>
                <p className="text-slate-600 text-sm line-clamp-4 flex-1">
                  {scenario.description}
                </p>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 text-center" onClick={() => onSelect(scenario)}>
                <span className="text-indigo-600 font-medium text-sm group-hover:underline">선택하기 &rarr;</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
