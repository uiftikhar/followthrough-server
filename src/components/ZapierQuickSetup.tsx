import React, { useState } from 'react';

interface ZapTemplate {
  id: string;
  title: string;
  description: string;
  trigger: string;
  action: string;
  difficulty: 'Easy' | 'Medium' | 'Advanced';
  estimatedTime: string;
  category: 'email' | 'calendar' | 'automation';
}

const ZapierQuickSetup: React.FC = () => {
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

  // Replace with your actual Zapier app ID once published
  const ZAPIER_APP_ID = 'followthrough-ai-integration';

  const zapTemplates: ZapTemplate[] = [
    {
      id: 'email-triage',
      title: 'Email Triage Automation',
      description: 'Automatically analyze and categorize incoming support emails with AI-powered insights',
      trigger: 'Gmail: New Email',
      action: 'FollowThrough AI: Trigger Email Triage',
      difficulty: 'Easy',
      estimatedTime: '5 min',
      category: 'email'
    },
    {
      id: 'daily-brief',
      title: 'Daily Email Brief',
      description: 'Get a daily AI-generated summary of unread emails with priorities and action items',
      trigger: 'Schedule: Every Day',
      action: 'FollowThrough AI: Find Emails + Draft Reply',
      difficulty: 'Medium',
      estimatedTime: '10 min',
      category: 'email'
    }
  ];

  const createZapUrl = (templateId: string): string => {
    const baseUrl = 'https://zapier.com/app/editor';
    
    switch (templateId) {
      case 'email-triage':
        return `${baseUrl}?trigger_app=gmail&action_app=${ZAPIER_APP_ID}`;
      case 'daily-brief':
        return `${baseUrl}?trigger_app=schedule&action_app=${ZAPIER_APP_ID}`;
      default:
        return `${baseUrl}?action_app=${ZAPIER_APP_ID}`;
    }
  };

  const handleCreateZap = (template: ZapTemplate) => {
    const zapUrl = createZapUrl(template.id);
    window.open(zapUrl, '_blank', 'width=1200,height=800');
  };

  const getDifficultyColor = (difficulty: string): string => {
    switch (difficulty) {
      case 'Easy': return '#10B981'; // green
      case 'Medium': return '#F59E0B'; // yellow
      case 'Advanced': return '#EF4444'; // red
      default: return '#6B7280'; // gray
    }
  };

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'email': return '📧';
      case 'calendar': return '📅';
      case 'automation': return '⚙️';
      default: return '⚡';
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: 'bold', 
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          ⚡ Zapier Automations
        </h1>
        <p style={{ 
          color: '#6B7280', 
          maxWidth: '600px', 
          margin: '0 auto',
          lineHeight: '1.5'
        }}>
          Connect FollowThrough AI with 5,000+ apps to automate your email triage, 
          meeting analysis, and task management workflows.
        </p>
      </div>

      {/* Quick Setup Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
        gap: '24px',
        marginBottom: '32px'
      }}>
        {zapTemplates.map((template) => (
          <div
            key={template.id}
            style={{
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '24px',
              backgroundColor: 'white',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              transition: 'box-shadow 0.2s',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
            }}
          >
            {/* Card Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>
                  {getCategoryIcon(template.category)}
                </span>
                <h3 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: '600',
                  margin: 0
                }}>
                  {template.title}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{
                  backgroundColor: getDifficultyColor(template.difficulty),
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '500'
                }}>
                  {template.difficulty}
                </span>
                <span style={{
                  backgroundColor: '#F3F4F6',
                  color: '#374151',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.75rem'
                }}>
                  {template.estimatedTime}
                </span>
              </div>
            </div>

            {/* Description */}
            <p style={{ 
              color: '#6B7280', 
              marginBottom: '16px',
              lineHeight: '1.5'
            }}>
              {template.description}
            </p>

            {/* Trigger and Action */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                marginBottom: '8px',
                fontSize: '0.875rem'
              }}>
                <span style={{ fontWeight: '500' }}>Trigger:</span>
                <span style={{ color: '#6B7280' }}>{template.trigger}</span>
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                fontSize: '0.875rem'
              }}>
                <span style={{ fontWeight: '500' }}>Action:</span>
                <span style={{ color: '#6B7280' }}>{template.action}</span>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={() => handleCreateZap(template)}
              style={{
                width: '100%',
                backgroundColor: '#3B82F6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '12px 16px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2563EB';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#3B82F6';
              }}
            >
              🚀 Create This Zap
            </button>
          </div>
        ))}
      </div>

      {/* Setup Instructions */}
      <div style={{
        backgroundColor: '#F9FAFB',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '24px'
      }}>
        <h3 style={{ 
          fontSize: '1.125rem', 
          fontWeight: '600',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          🚀 Quick Setup Guide
        </h3>
        
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{
              width: '24px',
              height: '24px',
              backgroundColor: '#3B82F6',
              color: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: '600',
              flexShrink: 0
            }}>
              1
            </div>
            <div>
              <h4 style={{ fontWeight: '600', margin: '0 0 4px 0' }}>
                Get Your API Key
              </h4>
              <p style={{ color: '#6B7280', margin: 0, fontSize: '0.875rem' }}>
                Go to Settings → Integrations → Zapier in your FollowThrough AI dashboard to generate your API key
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{
              width: '24px',
              height: '24px',
              backgroundColor: '#3B82F6',
              color: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: '600',
              flexShrink: 0
            }}>
              2
            </div>
            <div>
              <h4 style={{ fontWeight: '600', margin: '0 0 4px 0' }}>
                Click "Create This Zap"
              </h4>
              <p style={{ color: '#6B7280', margin: 0, fontSize: '0.875rem' }}>
                Choose a template above and click the button to open Zapier with pre-configured settings
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{
              width: '24px',
              height: '24px',
              backgroundColor: '#3B82F6',
              color: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: '600',
              flexShrink: 0
            }}>
              3
            </div>
            <div>
              <h4 style={{ fontWeight: '600', margin: '0 0 4px 0' }}>
                Connect & Configure
              </h4>
              <p style={{ color: '#6B7280', margin: 0, fontSize: '0.875rem' }}>
                Connect your Gmail and FollowThrough AI accounts, then customize the automation settings
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{
              width: '24px',
              height: '24px',
              backgroundColor: '#10B981',
              color: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: '600',
              flexShrink: 0
            }}>
              4
            </div>
            <div>
              <h4 style={{ fontWeight: '600', margin: '0 0 4px 0' }}>
                Test & Activate
              </h4>
              <p style={{ color: '#6B7280', margin: 0, fontSize: '0.875rem' }}>
                Test your Zap to ensure it works correctly, then turn it on to start automating!
              </p>
            </div>
          </div>
        </div>

        {/* API Key Info */}
        <div style={{
          backgroundColor: '#EBF8FF',
          border: '1px solid #BEE3F8',
          borderRadius: '6px',
          padding: '12px',
          marginTop: '16px'
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1rem' }}>ℹ️</span>
            <div>
              <p style={{ 
                margin: 0, 
                fontSize: '0.875rem',
                color: '#1E40AF'
              }}>
                <strong>Need your API key?</strong> Your API key format will look like: 
                <code style={{ 
                  backgroundColor: 'white', 
                  padding: '2px 4px', 
                  borderRadius: '3px',
                  fontSize: '0.75rem',
                  margin: '0 4px'
                }}>
                  followthrough_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                </code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZapierQuickSetup; 