import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { createSession } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(req) {
  try {
    const { email, verificationCode } = await req.json();

    if (!email || !verificationCode) {
      return NextResponse.json(
        { success: false, message: 'Email and verification code are required' },
        { status: 400 }
      );
    }

    // Verify the code and get temp user
    const { data: tempUser } = await supabaseAdmin
      .from('temp_users')
      .select('*')
      .eq('email', email)
      .eq('verification_code', verificationCode)
      .maybeSingle();

    if (!tempUser) {
      return NextResponse.json(
        { success: false, message: 'Invalid verification code or email not found' },
        { status: 400 }
      );
    }

    if (new Date() > new Date(tempUser.verification_code_expires)) {
      return NextResponse.json(
        { success: false, message: 'Verification code has expired' },
        { status: 400 }
      );
    }

    // Create permanent user
    const newUserId = crypto.randomUUID();
    const { data: newUser, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: newUserId,
        first_name: tempUser.first_name,
        last_name: tempUser.last_name,
        email: tempUser.email,
        password_hash: tempUser.password, // already hashed
        is_active: true,
        is_subscribed: false,
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (userError) throw userError;

    // Create trial subscription
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14);

    const { data: trialSubscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        id: crypto.randomUUID(),
        user_id: newUserId,
        plan_type: 'free',
        plan_name: 'Trial Plan - Full Access',
        status: 'trial',
        billing_cycle: 'trial',
        price: 0,
        currency: 'USD',
        start_date: new Date().toISOString(),
        end_date: trialEndDate.toISOString(),
        features: {
          realTimeStockTracking: true,
          advancedReporting: true,
          freeWebsite: true,
          whatsappCheckout: true,
          aiReports: true,
          unlimitedUsers: true,
          stockAlerts: true,
          purchaseOrders: true,
          multiLocation: true,
          cloudBackup: true,
          prioritySupport: true
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (subError) throw subError;

    // Update user with subscription info
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        is_subscribed: true,
        date_subscribed: new Date().toISOString(),
        current_subscription_id: trialSubscription.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', newUserId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Clean up temp user
    await supabaseAdmin.from('temp_users').delete().eq('id', tempUser.id);

    // Send welcome email
    await sendWelcomeEmail(updatedUser.email, updatedUser.first_name);

    // Create session
    const response = NextResponse.json({
      success: true,
      message: 'Email verified successfully! Welcome to Stora!',
      user: {
        id: updatedUser.id,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: updatedUser.is_active,
        isSubscribed: updatedUser.is_subscribed,
        dateSubscribed: updatedUser.date_subscribed,
        currentSubscription: updatedUser.current_subscription_id,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at
      }
    });

    await createSession(newUserId, req, response);

    return response;

  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
