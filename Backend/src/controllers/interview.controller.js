const pdfParse = require("pdf-parse")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReports.model")




/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterViewReportController(req, res) {
    try {
        const resumeContent = await (new pdfParse.PDFParse(
            Uint8Array.from(req.file.buffer)
        )).getText();

        const { selfDescription, jobDescription } = req.body;

        const interViewReportByAi = await generateInterviewReport({
            resume: resumeContent.text,
            selfDescription,
            jobDescription
        });

        console.log("AI DATA:", interViewReportByAi);

        const extractCandidateName = (text = "") => {
            const normalized = text.replace(/\r/g, "").trim();
            const lines = normalized.split("\n").map(line => line.trim()).filter(Boolean);

            if (lines.length === 0) return undefined;

            const firstLine = lines[0];
            if (/^[A-Z][a-zA-Z'’\.\-\s]{1,40}$/.test(firstLine) && firstLine.split(/\s+/).length <= 5) {
                return firstLine;
            }

            const nameMatch = normalized.match(/(?:Name|Candidate Name|Resume for|Profile)\s*[:\-]?\s*([A-Z][a-zA-Z'’\.\-\s]{1,40})/i);
            if (nameMatch && nameMatch[1]) {
                return nameMatch[1].trim();
            }

            for (let i = 0; i < Math.min(lines.length, 5); i += 1) {
                const line = lines[i];
                if (/^[A-Z][a-zA-Z'’\.\-\s]{1,40}$/.test(line) && line.split(/\s+/).length <= 5) {
                    return line;
                }
            }

            return undefined;
        };

        const candidateName = extractCandidateName(resumeContent.text);

        // ✅ FORMAT QUESTIONS (TECH + BEHAVIORAL)
        const formatQuestions = (arr = []) => {
            const result = [];

            for (let i = 0; i < arr.length; i += 6) {
                result.push({
                    question: arr[i + 1] || "Sample question",
                    intention: arr[i + 3] || "Understand candidate thinking",
                    answer: arr[i + 5] || "Provide a structured answer"
                });
            }

            return result;
        };

        // ✅ FORMAT SKILL GAPS
        const formatSkillGaps = (arr = []) => {
            const result = [];

            for (let i = 0; i < arr.length; i += 4) {
                result.push({
                    skill: arr[i + 1] || "Unknown Skill",
                    reason: "Needs improvement", // ✅ added (important)
                    severity: ["low", "medium", "high"].includes(arr[i + 3])
                        ? arr[i + 3]
                        : "medium"
                });
            }

            return result;
        };

        // ✅ NORMALIZE QUESTIONS
        const normalizeQuestions = (arr = []) => {
            if (!Array.isArray(arr)) return [];

            // If the AI returned a single flat list of values, parse it in groups.
            if (arr.length > 0 && typeof arr[0] === "string") {
                return formatQuestions(arr);
            }

            return arr.map((item, index) => {
                if (Array.isArray(item)) {
                    return {
                        question: item[1] || item[0] || `Question ${index + 1}`,
                        intention: item[3] || item[2] || "Understand candidate thinking",
                        answer: item[5] || item[4] || "Provide a structured answer"
                    };
                }

                if (item && typeof item === "object") {
                    return {
                        question: item.question || item.prompt || item.text || `Question ${index + 1}`,
                        intention: item.intention || item.intent || "Understand candidate thinking",
                        answer: item.answer || item.response || item.explanation || "Provide a structured answer"
                    };
                }

                if (typeof item === "string") {
                    return {
                        question: item,
                        intention: "Understand candidate thinking",
                        answer: "Provide a structured answer"
                    };
                }

                return {
                    question: `Question ${index + 1}`,
                    intention: "Understand candidate thinking",
                    answer: "Provide a structured answer"
                };
            });
        };

        // ✅ NORMALIZE SKILL GAPS
        const normalizeSkillGaps = (arr = []) => {
            if (!Array.isArray(arr)) return [];

            return arr.map((item, index) => {
                if (item && typeof item === "object") {
                    return {
                        skill: item.skill || item.name || `Skill ${index + 1}`,
                        severity: ["low", "medium", "high"].includes(item.severity)
                            ? item.severity
                            : "medium"
                    };
                }

                if (typeof item === "string") {
                    return {
                        skill: item,
                        severity: "medium"
                    };
                }

                return {
                    skill: `Skill ${index + 1}`,
                    severity: "medium"
                };
            });
        };

        // ✅ NORMALIZE PREPARATION PLAN
        const normalizePreparationPlan = (arr = []) => {
            if (!Array.isArray(arr)) return [];

            return arr.map((item, index) => {
                if (item && typeof item === "object") {
                    const tasks = Array.isArray(item.tasks)
                        ? item.tasks
                        : item.tasks
                            ? [item.tasks]
                            : item.task
                                ? [item.task]
                                : ["Practice and revise"];

                    return {
                        day: typeof item.day === "number" ? item.day : index + 1,
                        focus: item.focus || item.topic || item.title || `Day ${index + 1} focus`,
                        tasks
                    };
                }

                if (typeof item === "string") {
                    return {
                        day: index + 1,
                        focus: item,
                        tasks: ["Practice and revise"]
                    };
                }

                return {
                    day: index + 1,
                    focus: `Day ${index + 1} focus`,
                    tasks: ["Practice and revise"]
                };
            });
        };

        // ✅ FORMAT FINAL DATA
        const formattedData = {
            technicalQuestions: normalizeQuestions(interViewReportByAi.technicalQuestions),
            behavioralQuestions: normalizeQuestions(interViewReportByAi.behavioralQuestions),
            skillGaps: normalizeSkillGaps(interViewReportByAi.skillGaps),
            preparationPlan: normalizePreparationPlan(interViewReportByAi.preparationPlan),
            matchScore: typeof interViewReportByAi.matchScore === "number" ? interViewReportByAi.matchScore : 0
        };

        // ✅ SAVE TO DB
        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            candidateName,
            title: jobDescription,
            resume: resumeContent.text,
            selfDescription,
            jobDescription,
            ...formattedData
        });

        res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: "Something went wrong",
            error: err.message
        });
    }
}
/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {

    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    res.status(200).json({
        message: "Interview report fetched successfully.",
        interviewReport
    })
}


/** 
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

    res.status(200).json({
        message: "Interview reports fetched successfully.",
        interviewReports
    })
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
    const { interviewReportId } = req.params

    const interviewReport = await interviewReportModel.findById(interviewReportId)

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const { resume, jobDescription, selfDescription } = interviewReport

    const pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
    })

    res.send(pdfBuffer)
}

module.exports = { generateInterViewReportController, getInterviewReportByIdController, getAllInterviewReportsController, generateResumePdfController }