import React, { useState, useEffect } from 'react'
import '../style/interview.scss'
import { useInterview } from '../hooks/useInterview.js'
import { useParams } from 'react-router'



const NAV_ITEMS = [
    { id: 'technical', label: 'Technical Questions', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>) },
    { id: 'behavioral', label: 'Behavioral Questions', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>) },
    { id: 'roadmap', label: 'Road Map', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>) },
]

const safeParseJson = (value) => {
    if (typeof value !== 'string') return value
    try {
        return JSON.parse(value)
    } catch {
        return value
    }
}

const parseSkillGaps = (skillGaps) => {
    const gaps = []
    skillGaps.forEach(gap => {
        const parsed = safeParseJson(gap)
        if (Array.isArray(parsed)) {
            let currentSkill = ''
            for (let i = 0; i < parsed.length; i++) {
                const value = String(parsed[i] ?? '').trim()
                const nextValue = String(parsed[i + 1] ?? '').trim()
                if (/^skill$/i.test(value) && nextValue) {
                    currentSkill = nextValue
                    i += 1
                } else if (/^severity$/i.test(value) && nextValue && currentSkill) {
                    gaps.push({ skill: currentSkill, severity: nextValue.toLowerCase() })
                    currentSkill = ''
                    i += 1
                }
            }
        } else if (typeof parsed === 'object' && parsed.skill && parsed.severity) {
            gaps.push({ skill: parsed.skill, severity: parsed.severity.toLowerCase() })
        } else {
            const normalized = normalizeSkillGap(gap)
            if (normalized.skill && normalized.severity) {
                gaps.push(normalized)
            }
        }
    })
    return gaps
}

const SkillGapCard = ({ skill, severity }) => {
    const severityClass = `severity--${severity}`
    return (
        <div className={`skill-gap-card ${severityClass}`}>
            <h4 className='skill-gap-card__skill'>{skill}</h4>
        </div>
    )
}

// ── Sub-components ────────────────────────────────────────────────────────────
const getRawAiText = (item) => {
    const parsed = safeParseJson(item)

    if (typeof parsed === 'string') {
        return parsed
    }

    if (Array.isArray(parsed)) {
        return parsed.filter(part => typeof part === 'string').join('\n')
    }

    if (parsed && typeof parsed === 'object') {
        const parts = []

        if (typeof parsed.question === 'string') {
            parts.push('question')
            parts.push(parsed.question)
        }
        if (typeof parsed.intention === 'string') {
            parts.push('intention')
            parts.push(parsed.intention)
        }
        if (typeof parsed.answer === 'string') {
            parts.push('answer')
            parts.push(parsed.answer)
        }

        if (parts.length > 0) {
            return parts.join('\n')
        }

        return parsed.prompt || parsed.text || parsed.response || JSON.stringify(parsed, null, 2)
    }

    return String(item)
}

const shouldNumberQuestionText = (text) => {
    return typeof text === 'string' && /^\s*question\b/i.test(text)
}

const capitalizeLabel = (label) => {
    return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()
}

const renderAiTextLines = (rawText) => {
    return rawText.split('\n').map((line, index) => {
        const trimmed = line.trim()
        const lower = trimmed.toLowerCase()

        if (['question', 'intention', 'answer'].includes(lower)) {
            return (
                <div key={index}>
                    <span className='ai-text-label'>{capitalizeLabel(lower)}</span>
                </div>
            )
        }

        if (/^q\d+\.\s*question\b/i.test(trimmed)) {
            const labelMatch = trimmed.match(/^(q\d+\.\s*question\b)(.*)$/i)
            const labelText = labelMatch[1].replace(/question$/i, 'Question')
            return (
                <div key={index}>
                    <span className='ai-text-label'>{labelText}</span>
                    <span>{labelMatch[2]}</span>
                </div>
            )
        }

        return <div key={index}>{line}</div>
    })
}

const formatSkillGapText = (item) => {
    const parsed = safeParseJson(item)
    const source = typeof parsed === 'object' && parsed !== null ? parsed : item

    const normalizeSeverity = (value) => {
        if (typeof value !== 'string') return ''
        const match = value.trim().match(/^(low|medium|high)$/i)
        return match ? match[1].toLowerCase() : ''
    }

    const formatEntry = (skill, severity) => {
        const cleanSkill = typeof skill === 'string' ? skill.trim() : ''
        const cleanSeverity = normalizeSeverity(severity)
        if (!cleanSkill) return ''
        return cleanSeverity ? `${cleanSkill} (${cleanSeverity})` : cleanSkill
    }

    if (Array.isArray(source)) {
        const entries = []
        let currentSkill = ''
        let currentSeverity = ''

        for (let i = 0; i < source.length; i += 1) {
            const value = String(source[i] ?? '').trim()
            const nextValue = String(source[i + 1] ?? '').trim()

            if (/^skill$/i.test(value) && nextValue) {
                currentSkill = nextValue
                i += 1
                continue
            }

            if (/^severity$/i.test(value) && nextValue) {
                currentSeverity = nextValue
                i += 1
                continue
            }

            if (currentSkill && currentSeverity) {
                const entry = formatEntry(currentSkill, currentSeverity)
                if (entry) entries.push(entry)
                currentSkill = ''
                currentSeverity = ''
            }

            const bracketMatch = value.match(/^(.+?)\s*\((low|medium|high)\)$/i)
            if (bracketMatch) {
                entries.push(`${bracketMatch[1].trim()} (${bracketMatch[2].toLowerCase()})`)
            }
        }

        if (currentSkill && currentSeverity) {
            const entry = formatEntry(currentSkill, currentSeverity)
            if (entry) entries.push(entry)
        }

        return entries.length > 0 ? entries.join('\n') : 'na'
    }

    if (typeof source === 'string') {
        const trimmed = source.trim()
        const bracketMatch = trimmed.match(/^(.+?)\s*\((low|medium|high)\)$/i)
        return bracketMatch ? `${bracketMatch[1].trim()} (${bracketMatch[2].toLowerCase()})` : 'na'
    }

    if (typeof source === 'object') {
        const name = source.skill || source.name || source.gap || ''
        const severity = source.severity || source.level || source.importance || ''
        const formatted = formatEntry(name, severity)
        return formatted || 'na'
    }

    return 'na'
}

const renderAiTextBlocks = (items = []) => {
    let questionCount = 0

    return items.map((item, index) => {
        let raw = getRawAiText(item)

        if (shouldNumberQuestionText(raw)) {
            questionCount += 1
            raw = raw.replace(/^\s*question\b/i, `Q${questionCount}. question`)
        }

        return (
            <div key={index} className='ai-text'>
                {renderAiTextLines(raw)}
            </div>
        )
    })
}

const RoadMapDay = ({ day }) => (
    <div className='roadmap-day'>
        <div className='roadmap-day__header'>
            <span className='roadmap-day__badge'>Day {day.day}</span>
            <h3 className='roadmap-day__focus'>{day.focus}</h3>
        </div>
        <ul className='roadmap-day__tasks'>
            {day.tasks.map((task, i) => (
                <li key={i}>
                    <span className='roadmap-day__bullet' />
                    {task}
                </li>
            ))}
        </ul>
    </div>
)

// ── Main Component ────────────────────────────────────────────────────────────
const Interview = () => {
    const [ activeNav, setActiveNav ] = useState('technical')
    const { report, getReportById, loading, getResumePdf } = useInterview()
    const { interviewId } = useParams()

    useEffect(() => {
        if (interviewId) {
            getReportById(interviewId)
        }
    }, [ interviewId ])



    if (loading || !report) {
        return (
            <main className='loading-screen'>
                <h1>Loading your interview plan...</h1>
            </main>
        )
    }

    const scoreColor =
        report.matchScore >= 80 ? 'score--high' :
            report.matchScore >= 60 ? 'score--mid' : 'score--low'


    return (
        <div className='interview-page'>
            <div className='interview-layout'>

                {/* ── Left Nav ── */}
                <nav className='interview-nav'>
                    <div className="nav-content">
                        <p className='interview-nav__label'>Sections</p>
                        {NAV_ITEMS.map(item => (
                            <button
                                key={item.id}
                                className={`interview-nav__item ${activeNav === item.id ? 'interview-nav__item--active' : ''}`}
                                onClick={() => setActiveNav(item.id)}
                            >
                                <span className='interview-nav__icon'>{item.icon}</span>
                                {item.label}
                            </button>
                        ))}
                    </div>
                </nav>

                <div className='interview-divider' />

                {/* ── Center Content ── */}
                <main className='interview-content'>
                    {activeNav === 'technical' && (
                        <section>
                            <div className='content-header'>
                                <h2>Technical Questions</h2>
                                <span className='content-header__count'>{report.technicalQuestions.length} questions</span>
                            </div>
                            <div className='ai-text-list'>
                                {renderAiTextBlocks(report.technicalQuestions)}
                            </div>
                        </section>
                    )}

                    {activeNav === 'behavioral' && (
                        <section>
                            <div className='content-header'>
                                <h2>Behavioral Questions</h2>
                                <span className='content-header__count'>{report.behavioralQuestions.length} questions</span>
                            </div>
                            <div className='ai-text-list'>
                                {renderAiTextBlocks(report.behavioralQuestions)}
                            </div>
                        </section>
                    )}

                    {activeNav === 'roadmap' && (
                        <section>
                            <div className='content-header'>
                                <h2>Preparation Road Map</h2>
                                <span className='content-header__count'>{report.preparationPlan.length}-day plan</span>
                            </div>
                            <div className='roadmap-list'>
                                {report.preparationPlan.map((day) => (
                                    <RoadMapDay key={day.day} day={day} />
                                ))}
                            </div>
                        </section>
                    )}
                </main>

                <div className='interview-divider' />

                {/* ── Right Sidebar ── */}
                <aside className='interview-sidebar'>

                    {/* Match Score */}
                    <div className='match-score'>
                        <p className='match-score__label'>Match Score</p>
                        <div className={`match-score__ring ${scoreColor}`}>
                            <span className='match-score__value'>{report.matchScore}</span>
                            <span className='match-score__pct'>%</span>
                        </div>
                        <p className='match-score__sub'>Strong match for this role</p>
                    </div>

                    <div className='sidebar-divider' />

                    {/* Skill Gaps */}
                    <div className='skill-gaps'>
                        <p className='skill-gaps__heading'>SKILL GAPS</p>
                        <div className='skill-gaps__cards'>
                            {parseSkillGaps(report.skillGaps).map((gap, i) => (
                                <SkillGapCard key={i} skill={gap.skill} severity={gap.severity} />
                            ))}
                        </div>
                    </div>

                </aside>
            </div>
        </div>
    )
}

export default Interview