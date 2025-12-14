import React, { useEffect, useState } from 'react';
import { ExerciseConfig, WorkoutSession } from '../types';
import { generateWorkoutReport } from '../services/aiService';

interface ReportViewProps {
  session: WorkoutSession;
  exercise: ExerciseConfig;
  onClose: () => void;
}

const ReportView: React.FC<ReportViewProps> = ({ session, exercise, onClose }) => {
  const [aiReport, setAiReport] = useState<{summary?: string, analysis?: string, tip?: string} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

useEffect(() => {
    console.log('');
    console.log('='.repeat(80));
    console.log('🏁 [ReportView] 开始生成报告');
    console.log('='.repeat(80));
    console.log('');
    
    // 🔴 详细验证接收到的数据
    console.log('📊 [ReportView] 接收到的 session 数据:');
    console.log('  - exerciseId:', session.exerciseId);
    console.log('  - duration:', session.duration, '秒');
    console.log('  - accuracyScore:', session.accuracyScore.toFixed(1), '分');
    console.log('  - correctionCount:', session.correctionCount, '次');
    console.log('  - feedbackLog 长度:', session.feedbackLog?.length || 0);
    console.log('  - poseAnalyses 长度:', session.poseAnalyses?.length || 0, '← 🔴 关键数据');
    console.log('  - errorPatterns:', session.errorPatterns || '无');
    console.log('  - performanceMetrics:', session.performanceMetrics || '无');
    console.log('  - timestamp:', new Date(session.timestamp).toLocaleString());
    console.log('');
    
    console.log('🎯 [ReportView] 接收到的 exercise 数据:');
    console.log('  - id:', exercise.id);
    console.log('  - name:', exercise.name);
    console.log('  - description:', exercise.description);
    console.log('  - durationSec:', exercise.durationSec);
    console.log('');
    
    // 🔴 关键检查：poseAnalyses 是否存在
    if (!session.poseAnalyses || session.poseAnalyses.length === 0) {
        console.error('❌❌❌ 严重错误：session.poseAnalyses 为空或不存在！');
        console.error('这意味着训练过程中没有记录任何姿态数据。');
        console.error('请检查 TrainingView 的 handleFinish 函数是否正确传递了数据。');
        console.error('');
        console.error('当前 session 对象的所有键:', Object.keys(session));
        console.error('完整 session 对象:', session);
    } else {
        console.log('✅ poseAnalyses 数据存在，包含', session.poseAnalyses.length, '条记录');
        console.log('   - 前3条示例:', session.poseAnalyses.slice(0, 3));
    }
    console.log('');
    
    const fetchReport = async () => {
        console.log('📤 [ReportView] 调用 generateWorkoutReport...');
        console.log('传递参数:', {
            exercise: {
                name: exercise.name,
                description: exercise.description
            },
            session: {
                duration: session.duration,
                accuracyScore: session.accuracyScore,
                correctionCount: session.correctionCount,
                poseAnalysesCount: session.poseAnalyses?.length || 0,
                errorPatterns: session.errorPatterns,
                performanceMetrics: session.performanceMetrics
            }
        });
        console.log('');
        
        setIsLoading(true);
        setLoadError(false);
        
        try {
            // 🔴 关键：直接传递完整的 session 和 exercise 对象
            console.log('📡 [ReportView] 调用 AI 服务...');
            const jsonStr = await generateWorkoutReport(session, exercise);
            
            console.log('📥 [ReportView] 收到 AI 响应');
            console.log('   响应类型:', typeof jsonStr);
            console.log('   响应长度:', jsonStr?.length || 0);
            console.log('   响应预览:', jsonStr?.substring(0, 150));
            console.log('');
            
            if (!jsonStr || jsonStr.trim() === '') {
                throw new Error('AI Service 返回空响应');
            }
            
            const parsed = JSON.parse(jsonStr);
            console.log('✅ [ReportView] JSON 解析成功:');
            console.log('   - summary:', parsed.summary);
            console.log('   - analysis:', parsed.analysis);
            console.log('   - tip:', parsed.tip);
            console.log('');
            
            // 验证数据完整性
            if (!parsed.summary || !parsed.analysis || !parsed.tip) {
                console.warn('⚠️ [ReportView] 报告数据不完整');
                console.log('缺失字段:', {
                    summary: !!parsed.summary,
                    analysis: !!parsed.analysis,
                    tip: !!parsed.tip
                });
                
                setAiReport({
                    summary: parsed.summary || "训练完成",
                    analysis: parsed.analysis || "数据处理中",
                    tip: parsed.tip || "继续训练"
                });
                setLoadError(true);
            } else {
                console.log('✅ [ReportView] 报告数据完整，设置状态');
                setAiReport(parsed);
                setLoadError(false);
            }
            
        } catch (error: any) {
            console.error('❌ [ReportView] 报告生成失败:');
            console.error('  - 错误类型:', error.name);
            console.error('  - 错误消息:', error.message);
            console.error('  - 错误堆栈:', error.stack);
            console.error('');
            
            setLoadError(true);
            
            // 智能备用方案
            const fallbackReport = {
                summary: `完成${exercise.name.split('(')[0].trim()}训练 ${session.duration}秒，评分 ${Math.round(session.accuracyScore)} 分`,
                analysis: session.correctionCount > 5 
                    ? `训练中出现 ${session.correctionCount} 次姿势纠正，建议放慢速度，注重动作质量。` 
                    : session.correctionCount > 0
                    ? `出现 ${session.correctionCount} 次小幅调整，整体表现良好，继续保持。`
                    : "动作规范度高，保持当前训练强度。",
                tip: session.accuracyScore < 70 
                    ? "建议反复观看标准示范视频，理解正确动作要领。" 
                    : session.accuracyScore < 85
                    ? "训练前充分热身，保持核心收紧，控制呼吸节奏。"
                    : "继续保持，可适当增加训练强度或时长。"
            };
            
            console.log('💾 [ReportView] 使用智能备用方案:', fallbackReport);
            setAiReport(fallbackReport);
        } finally {
            setIsLoading(false);
            console.log('🏁 [ReportView] 报告获取流程结束');
            console.log('='.repeat(80));
            console.log('');
        }
    };
    
    fetchReport();
  }, [session, exercise]);

  return (
    <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
                <div className="inline-block p-3 rounded-full bg-green-500/20 text-green-400 mb-4 border border-green-500/30">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">训练报告</h2>
                <p className="text-slate-400">{new Date(session.timestamp).toLocaleTimeString()}</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                    <p className="text-slate-400 text-xs uppercase">动作规范分</p>
                    <p className="text-3xl font-bold text-white mt-1">{Math.round(session.accuracyScore)}</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                    <p className="text-slate-400 text-xs uppercase">矫正次数</p>
                    <p className={`text-3xl font-bold mt-1 ${session.correctionCount > 5 ? 'text-red-400' : 'text-blue-400'}`}>
                        {session.correctionCount}
                    </p>
                </div>
            </div>

            {/* 🔴 新增：详细数据展示 */}
            {session.poseAnalyses && session.poseAnalyses.length > 0 && (
                <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 mb-6">
                    <p className="text-slate-400 text-xs uppercase mb-2">训练详情</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                            <span className="text-slate-400">记录帧数:</span>
                            <span className="text-white ml-2">{session.poseAnalyses.length}</span>
                        </div>
                        {session.performanceMetrics && (
                            <>
                                <div>
                                    <span className="text-slate-400">平均角度:</span>
                                    <span className="text-white ml-2">{session.performanceMetrics.avgAngle}°</span>
                                </div>
                                <div>
                                    <span className="text-slate-400">稳定性:</span>
                                    <span className="text-white ml-2">{session.performanceMetrics.stabilityScore}分</span>
                                </div>
                                <div>
                                    <span className="text-slate-400">一致性:</span>
                                    <span className="text-white ml-2">{session.performanceMetrics.consistencyScore.toFixed(0)}%</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* AI Analysis */}
            <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 rounded-2xl p-6 mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                    </svg>
                </div>
                
                <h3 className="text-indigo-300 font-bold mb-4 flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-indigo-400 animate-pulse' : loadError ? 'bg-yellow-400' : 'bg-green-400'}`}></span>
                    AI 治疗师点评
                    {loadError && <span className="text-xs text-yellow-400">(智能备用)</span>}
                </h3>

                {isLoading ? (
                    <div className="space-y-3 animate-pulse">
                        <div className="h-4 bg-indigo-400/20 rounded w-3/4"></div>
                        <div className="h-4 bg-indigo-400/20 rounded w-full"></div>
                        <div className="h-4 bg-indigo-400/20 rounded w-5/6"></div>
                        <div className="flex items-center gap-2 mt-4">
                            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm text-indigo-300">AI 分析中...</span>
                        </div>
                    </div>
                ) : aiReport ? (
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm text-indigo-200 font-semibold">综合表现</p>
                            <p className="text-white text-sm leading-relaxed mt-1">{aiReport.summary}</p>
                        </div>
                        <div>
                            <p className="text-sm text-indigo-200 font-semibold">主要问题</p>
                            <p className="text-white text-sm leading-relaxed mt-1">{aiReport.analysis}</p>
                        </div>
                        <div className="bg-indigo-950/50 p-3 rounded-lg border border-indigo-500/20">
                            <p className="text-xs text-indigo-300 font-bold uppercase">下一次建议</p>
                            <p className="text-white text-sm mt-1">{aiReport.tip}</p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <p className="text-red-300 text-sm">报告生成失败</p>
                        <p className="text-slate-400 text-xs mt-2">请检查网络连接或API配置</p>
                    </div>
                )}
            </div>

            {/* Debug Info */}
            {(!session.poseAnalyses || session.poseAnalyses.length === 0) && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4 text-xs">
                    <p className="text-red-300 font-semibold mb-1">⚠️ 数据异常</p>
                    <p className="text-red-200/70">未检测到姿态分析数据，可能原因：</p>
                    <ul className="text-red-200/70 mt-1 ml-4 list-disc">
                        <li>训练时状态未切换到 ACTIVE</li>
                        <li>MediaPipe 初始化失败</li>
                        <li>摄像头画面中看不到人体</li>
                    </ul>
                    <button 
                        onClick={() => {
                            console.log('=== 手动数据检查 ===');
                            console.log('完整 Session 对象:', session);
                            console.log('完整 Exercise 对象:', exercise);
                            console.log('AI Report:', aiReport);
                        }}
                        className="mt-2 text-red-300 underline hover:text-red-200"
                    >
                        点击输出完整数据到控制台
                    </button>
                </div>
            )}

            <button 
                onClick={onClose}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white py-4 rounded-xl font-bold transition-colors"
            >
                返回主页
            </button>
        </div>
    </div>
  );
};

export default ReportView;
