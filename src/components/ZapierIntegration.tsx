import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Zap, Mail, Calendar, Settings, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ZapTemplate {
  id: string;
  title: string;
  description: string;
  trigger: string;
  action: string;
  zapierUrl: string;
  embedUrl: string;
  category: 'email' | 'calendar' | 'automation';
  difficulty: 'Easy' | 'Medium' | 'Advanced';
  estimatedTime: string;
}

const ZapierIntegration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'templates' | 'setup' | 'status'>('templates');
  const [connectedZaps, setConnectedZaps] = useState<string[]>([]);

  const zapTemplates: ZapTemplate[] = [
    {
      id: 'email-triage',
      title: 'Automated Email Triage',
      description: 'Automatically analyze and categorize incoming support emails with AI-powered insights',
      trigger: 'Gmail: New Email',
      action: 'FollowThrough AI: Trigger Email Triage',
      zapierUrl: 'https://zapier.com/app/editor/template/your-template-id-1',
      embedUrl: 'https://zapier.com/partner/embed/your-template-id-1',
      category: 'email',
      difficulty: 'Easy',
      estimatedTime: '5 min'
    },
    {
      id: 'daily-brief',
      title: 'Daily Email Brief',
      description: 'Get a daily AI-generated summary of unread emails with priorities and action items',
      trigger: 'Schedule: Every Day',
      action: 'FollowThrough AI: Find Emails + Draft Reply',
      zapierUrl: 'https://zapier.com/app/editor/template/your-template-id-2',
      embedUrl: 'https://zapier.com/partner/embed/your-template-id-2',
      category: 'email',
      difficulty: 'Medium',
      estimatedTime: '10 min'
    },
    {
      id: 'meeting-analysis',
      title: 'Meeting Follow-up Automation',
      description: 'Automatically analyze calendar events and generate follow-up tasks and summaries',
      trigger: 'Google Calendar: New Event',
      action: 'FollowThrough AI: Trigger Meeting Analysis',
      zapierUrl: 'https://zapier.com/app/editor/template/your-template-id-3',
      embedUrl: 'https://zapier.com/partner/embed/your-template-id-3',
      category: 'calendar',
      difficulty: 'Medium',
      estimatedTime: '8 min'
    },
    {
      id: 'task-extraction',
      title: 'Email to Task Automation',
      description: 'Extract actionable tasks from emails and create them in your project management tool',
      trigger: 'Gmail: Email Matching Search',
      action: 'FollowThrough AI: Create Task From Email',
      zapierUrl: 'https://zapier.com/app/editor/template/your-template-id-4',
      embedUrl: 'https://zapier.com/partner/embed/your-template-id-4',
      category: 'automation',
      difficulty: 'Advanced',
      estimatedTime: '15 min'
    }
  ];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'calendar': return <Calendar className="h-4 w-4" />;
      case 'automation': return <Settings className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCreateZap = (template: ZapTemplate) => {
    // Open Zapier template in new window
    window.open(template.zapierUrl, '_blank', 'width=1200,height=800');
  };

  const handleEmbedZap = (template: ZapTemplate) => {
    // Open embedded Zapier editor
    const embedWindow = window.open('', '_blank', 'width=1000,height=700');
    if (embedWindow) {
      embedWindow.document.write(`
        <html>
          <head>
            <title>Setup ${template.title}</title>
            <style>
              body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
              .header { text-align: center; margin-bottom: 20px; }
              .embed-container { width: 100%; height: 600px; border: 1px solid #e1e5e9; border-radius: 8px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>${template.title}</h2>
              <p>${template.description}</p>
            </div>
            <iframe 
              src="${template.embedUrl}" 
              class="embed-container"
              frameborder="0">
            </iframe>
          </body>
        </html>
      `);
    }
  };

  const TabButton: React.FC<{ id: string; label: string; icon: React.ReactNode }> = ({ id, label, icon }) => (
    <Button
      variant={activeTab === id ? 'default' : 'outline'}
      onClick={() => setActiveTab(id as any)}
      className="flex items-center gap-2"
    >
      {icon}
      {label}
    </Button>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Zap className="h-8 w-8 text-orange-500" />
          Zapier Automations
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Connect FollowThrough AI with 5,000+ apps to automate your email triage, 
          meeting analysis, and task management workflows.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex justify-center gap-4">
        <TabButton id="templates" label="Zap Templates" icon={<Zap className="h-4 w-4" />} />
        <TabButton id="setup" label="Setup Guide" icon={<Settings className="h-4 w-4" />} />
        <TabButton id="status" label="Connected Zaps" icon={<CheckCircle className="h-4 w-4" />} />
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {zapTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(template.category)}
                    <CardTitle className="text-lg">{template.title}</CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={getDifficultyColor(template.difficulty)}>
                      {template.difficulty}
                    </Badge>
                    <Badge variant="outline">{template.estimatedTime}</Badge>
                  </div>
                </div>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Trigger:</span>
                    <span className="text-gray-600">{template.trigger}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Action:</span>
                    <span className="text-gray-600">{template.action}</span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleCreateZap(template)}
                    className="flex-1 flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Create Zap
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => handleEmbedZap(template)}
                    className="flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Quick Setup
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Setup Guide Tab */}
      {activeTab === 'setup' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>🚀 Quick Setup Guide</CardTitle>
              <CardDescription>
                Follow these steps to connect FollowThrough AI with Zapier
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold">Connect Your Accounts</h3>
                    <p className="text-gray-600">Connect your Gmail and FollowThrough AI accounts to Zapier</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold">Choose a Template</h3>
                    <p className="text-gray-600">Select one of our pre-built templates or create a custom Zap</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold">Configure & Test</h3>
                    <p className="text-gray-600">Set up your triggers and actions, then test your automation</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-semibold">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold">Go Live!</h3>
                    <p className="text-gray-600">Turn on your Zap and let AI handle your email workflows</p>
                  </div>
                </div>
              </div>

              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  <strong>Need your API key?</strong> Go to Settings → Integrations → Zapier in your FollowThrough AI dashboard to generate your API key.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Authentication Setup */}
          <Card>
            <CardHeader>
              <CardTitle>🔐 Authentication Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">FollowThrough AI Connection</h4>
                <p className="text-sm text-gray-600 mb-3">
                  You'll need your API key to connect FollowThrough AI to Zapier:
                </p>
                <code className="bg-white p-2 rounded border text-sm block">
                  API Key: followthrough_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                </code>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Gmail Connection</h4>
                <p className="text-sm text-gray-600">
                  Zapier will guide you through connecting your Gmail account with OAuth2 authentication.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Tab */}
      {activeTab === 'status' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>📊 Connected Zaps Status</CardTitle>
              <CardDescription>
                Monitor your active Zapier automations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {connectedZaps.length === 0 ? (
                <div className="text-center py-8">
                  <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">No Connected Zaps</h3>
                  <p className="text-gray-500 mb-4">
                    Create your first automation to get started
                  </p>
                  <Button onClick={() => setActiveTab('templates')}>
                    Browse Templates
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Connected zaps would be listed here */}
                  <p className="text-gray-600">Your connected Zaps will appear here once created.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ZapierIntegration; 