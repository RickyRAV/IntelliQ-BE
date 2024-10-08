import {generateQuizQuestions} from "../services/quizService.js";
import {prisma} from "../config/prismaClient.js";

const welcome = async (req, res) => {
    res.send('Welcome to the IntelliQ-BE API! For Documentation please visit: intelliq-be.azurewebsites.net/api-docs/');
};

const getQuiz = async (req, res) => {
    const {user: {id: user_id}} = req.user;
    const startTime = process.hrtime();

    try {
        const {interests, numberOfQuestions} = req.query;
        const rawQuestions = await generateQuizQuestions(interests, numberOfQuestions);
        const endTime = process.hrtime(startTime);
        const timeTaken = (endTime[0] * 1000 + endTime[1] / 1000000) / 1000;
        res.json({rawQuestions: rawQuestions.rawQuestions, seed: rawQuestions.quiz_seed});
        const usage = await prisma.user_usage_data.create({
            data: {
                user_id: user_id,
                prompt_tokens: rawQuestions.usageData.prompt_tokens,
                completion_tokens: rawQuestions.usageData.completion_tokens,
                total_tokens: rawQuestions.usageData.total_tokens,
                system_fingerprint: rawQuestions.system_fingerprint,
                quiz_seed: rawQuestions.quiz_seed,
                used_model: rawQuestions.model,
                count_Questions: Number(numberOfQuestions),
                response_time_taken: timeTaken
            }
        });
    } catch (e) {
        res.status(500).json({error: 'An error occurred while generating quiz questions.', message: e.message});
    }
};

const saveQuizResults = async (req, res) => {
    const {user: {id: user_id}} = req.user;

    try {
        const {rawQuestions} = req.body;
        let {quizTitle, questions, timeTaken} = rawQuestions;
        // let {quizTitle, questions, timeTaken, quizTopics} = rawQuestions;
        // quizTopics = quizTopics[0].split(',').map(topic => topic.trim());
        // console.log(quizTopics)

        // const createdQuiz = await prisma.quizzes.create({
        //     data: {
        //         user_id: user_id,
        //         quiz_title: quizTitle,
        //         total_time_taken: timeTaken,
        //         correct_answers_count: 0,
        //         topics: quizTopics
        //     }
        // });
        const createdQuiz = await prisma.quizzes.create({
            data: {
                user_id: user_id,
                quiz_title: quizTitle,
                total_time_taken: timeTaken,
                correct_answers_count: 0,
            }
        });

        const correctAnswersCount = questions.reduce((count, question) =>
            count + (question.userAnswer === question.correctAnswer ? 1 : 0), 0);

        const transactionOperations = questions.map(question => async () => {
            const isCorrect = question.userAnswer === question.correctAnswer;
            const createdQuestion = await prisma.questions.create({
                data: {
                    text: question.text,
                    options: question.options,
                    correct_answer: question.correctAnswer,
                    quiz_id: createdQuiz.id
                }
            });

            return prisma.user_responses.create({
                data: {
                    question_id: createdQuestion.id,
                    quiz_id: createdQuiz.id,
                    user_answer: question.userAnswer,
                    is_correct: isCorrect
                }
            });
        });

        await Promise.all(transactionOperations.map(operation => operation()));

        await prisma.quizzes.update({
            where: {id: createdQuiz.id},
            data: {correct_answers_count: correctAnswersCount}
        });

        const formattedResponse = {
            quiz_id: createdQuiz.id,
            rawQuestions: {
                quiz_title: quizTitle,
                timeTaken,
                correctAnswersCount,
                questions: questions.map(question => ({
                    text: question.text,
                    correctAnswer: question.correctAnswer,
                    userAnswer: question.userAnswer
                })),
            },
        };

        res.status(201).json(formattedResponse);
    } catch (error) {
        console.error('Error saving quiz data:', error);
        res.status(500).json({message: 'An error occurred while saving quiz data.', error: error});
    }
};

export {welcome, getQuiz, saveQuizResults};
