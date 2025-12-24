'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import DashboardNav from '@/components/DashboardNav'
import EchoLoader from '@/components/EchoLoader'
import TrainingBotEnhanced from '@/components/TrainingBotEnhanced'

// Scenario definitions by domain
const scenariosByDomain = {
  pharmacy: [
    {
      id: 'medication-counseling',
      name: 'Medication Counseling',
      description: 'Guiding patients on proper medication use',
      icon: '💊'
    },
    {
      id: 'pharmacy-checkin',
      name: 'Pharmacy Check-in',
      description: 'Initial patient interaction and prescription assessment',
      icon: '👋'
    },
    {
      id: 'drug-interaction',
      name: 'Drug Interaction Management',
      description: 'Handling complex medication combinations',
      icon: '⚠️'
    },
    {
      id: 'patient-education',
      name: 'Patient Education',
      description: 'Teaching about medications and health conditions',
      icon: '📚'
    },
    {
      id: 'emergency-dispensing',
      name: 'Emergency Dispensing',
      description: 'Rapid response to urgent medication needs',
      icon: '🚨'
    }
  ],
  nursing: [
    {
      id: 'patient-checkin',
      name: 'Patient Check-in',
      description: 'Welcome and initial patient assessment',
      icon: '👋'
    },
    {
      id: 'difficult-diagnosis-support',
      name: 'Difficult Diagnosis Support',
      description: 'Assisting with challenging patient updates',
      icon: '🩺'
    },
    {
      id: 'emergency-response',
      name: 'Emergency Response',
      description: 'Managing high-pressure situations',
      icon: '🚨'
    },
    {
      id: 'pediatric-care',
      name: 'Pediatric Care',
      description: 'Working with children and their parents',
      icon: '👶'
    }
  ],
  medicine: [
    {
      id: 'difficult-diagnosis',
      name: 'Difficult Diagnosis',
      description: 'Delivering challenging news to patients',
      icon: '🩺'
    },
    {
      id: 'emergency-response',
      name: 'Emergency Response',
      description: 'Handling high-pressure medical situations',
      icon: '🚨'
    },
    {
      id: 'end-of-life-care',
      name: 'End-of-Life Care',
      description: 'Offering compassionate communication',
      icon: '💙'
    },
    {
      id: 'pediatric-care',
      name: 'Pediatric Care',
      description: 'Treating and communicating with children and parents',
      icon: '👶'
    }
  ]
}

export default function TrainingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userDomain, setUserDomain] = useState<string>('nursing')
  const [scenarios, setScenarios] = useState<any[]>([])
  const [lectureSimulation, setLectureSimulation] = useState<any>(null)

  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  // Check for lecture simulation mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('mode') === 'lecture_simulation') {
        const simData = localStorage.getItem('lecture_simulation')
        if (simData) {
          const simulation = JSON.parse(simData)
          setLectureSimulation(simulation)
          // Create a custom scenario from the simulation
          setScenarios([{
            id: simulation.scenario_id,
            name: simulation.title,
            description: simulation.patient_context,
            icon: '📖',
            custom_scenario: `Patient Background: ${simulation.patient_background}\n\nOpening: "${simulation.opening_line}"\n\nKey Concerns: ${simulation.key_concerns?.join(', ')}\n\nMedications: ${simulation.medications?.join(', ')}\n\nExpected Actions: ${simulation.expected_actions?.join(', ')}`
          }])
          setUserDomain('lecture')
          setLoading(false)
          return
        }
      }
    }
  }, [])

  const checkUser = useCallback(async () => {
    if (!user || lectureSimulation) {
      return
    }

    // Default to pharmacy since that's the only enabled category
    setUserDomain('pharmacy')

    // Get scenarios for pharmacy (only enabled category)
    const domainScenarios = scenariosByDomain.pharmacy
    console.log('Selected scenarios:', domainScenarios)
    setScenarios(domainScenarios)

    setLoading(false)
  }, [user, lectureSimulation])

  useEffect(() => {
    checkUser()
  }, [checkUser])

  if (loading) {
    return (
      <div className="dashboard-page-container">
        <DashboardNav />
        <EchoLoader context="training" />
      </div>
    )
  }

  return (
    <div className="dashboard-page-container">
      <DashboardNav />

      <div className="max-w-[1512px] mx-auto px-2 sm:px-4 lg:px-16 pb-6 sm:pb-8">
        {/* Lecture Simulation Banner */}
        {lectureSimulation && (
          <div className="bg-gradient-to-r from-[#344895] to-[#1A1F71] rounded-2xl p-6 mb-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📖</span>
              <div>
                <p className="text-white/70 text-sm">Practicing from lecture</p>
                <h2 className="font-montserrat font-bold text-xl">{lectureSimulation.lecture_title}</h2>
              </div>
            </div>
            <p className="text-white/80 text-sm mt-3">
              <strong>Scenario:</strong> {lectureSimulation.patient_context}
            </p>
            <p className="text-white/60 text-xs mt-2">
              Click &quot;Start&quot; below to begin the voice practice session with this patient scenario.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mb-4 sm:mb-6 lg:mb-8 pt-2">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-montserrat font-bold text-black">
            {lectureSimulation ? 'Lecture Practice Session' : 'AI Training Simulator'}
          </h1>
          <div className="px-4 py-2 bg-[#344895] text-white rounded-full font-lato font-medium text-sm">
            {lectureSimulation ? '📖 Lecture Mode' : `${userDomain.charAt(0).toUpperCase() + userDomain.slice(1)} Domain`}
          </div>
        </div>
        <p className="text-base sm:text-lg lg:text-xl font-lato text-gray-600 mb-6 sm:mb-8">
          {lectureSimulation
            ? 'Practice patient communication based on your lecture content. The AI will roleplay as a patient with the scenario from your notes.'
            : 'Practice patient communication with Echo, your AI-powered training companion. Choose a scenario or start a conversation below.'}
        </p>

        {/* Interactive Voice Training Bot */}
        <TrainingBotEnhanced scenarios={scenarios} lectureSimulation={lectureSimulation} />
      </div>
    </div>
  )
}

