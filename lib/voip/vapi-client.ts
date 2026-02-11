/**
 * Vapi.ai Client for VOIP Integration
 * 
 * This client interfaces with Vapi.ai's API to initiate and manage phone calls.
 * For MVP, uses REST API directly. Can be replaced with SDK later.
 */

interface VapiCall {
  id: string;
  status: string;
  phoneNumber: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  recordingUrl?: string;
  transcript?: string;
}

interface CreateCallParams {
  phoneNumber: string;
  callId: string;
  firstMessage: string;
}

export class VapiClient {
  private apiKey: string;
  private baseUrl: string = 'https://api.vapi.ai';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.VAPI_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('VAPI_API_KEY not configured. VOIP calls will not work.');
    }
  }

  /**
   * Initiate a phone call to a supplier
   */
  async initiateCall(params: CreateCallParams): Promise<VapiCall> {
    if (!this.apiKey) {
      throw new Error('VAPI_API_KEY not configured');
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const response = await fetch(`${this.baseUrl}/call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID, // Your Vapi phone number
        customer: {
          number: params.phoneNumber,
        },
        assistant: {
          firstMessage: params.firstMessage,
          model: {
            provider: 'custom-llm',
            url: `${appUrl}/api/voip/langgraph-handler`,
            headers: {
              'Authorization': `Bearer ${process.env.VOIP_WEBHOOK_SECRET || 'dev-secret'}`,
            },
          },
          voice: {
            provider: '11labs',
            voiceId: process.env.VAPI_VOICE_ID || 'professional-male',
          },
          // Background messages for voicemail detection
          backgroundDenoising: true,
          backgroundSound: 'off',
        },
        serverMessages: ['transcript', 'status-update', 'end-of-call-report'],
        serverUrl: `${appUrl}/api/voip/webhooks`,
        metadata: {
          callId: params.callId,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vapi API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * End an active call
   */
  async endCall(vapiCallId: string): Promise<void> {
    if (!this.apiKey) {
      throw new Error('VAPI_API_KEY not configured');
    }

    const response = await fetch(`${this.baseUrl}/call/${vapiCallId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vapi API error: ${response.status} - ${error}`);
    }
  }

  /**
   * Get call details
   */
  async getCall(vapiCallId: string): Promise<VapiCall> {
    if (!this.apiKey) {
      throw new Error('VAPI_API_KEY not configured');
    }

    const response = await fetch(`${this.baseUrl}/call/${vapiCallId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Vapi API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * Check if Vapi is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

// Singleton instance
export const vapiClient = new VapiClient();
