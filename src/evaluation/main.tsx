import React from 'react'
import { createRoot } from 'react-dom/client'
import { EvaluationReview } from './review'
import './review.css'

createRoot(document.getElementById('root')!).render(<React.StrictMode><EvaluationReview /></React.StrictMode>)
