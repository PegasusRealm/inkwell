#!/bin/bash

# Cloud Run Revision Cleanup Script for InkWell
echo "🧹 Starting Cloud Run revision cleanup..."

# Function to clean up old revisions (keep latest 3)
cleanup_service_revisions() {
    local service_name=$1
    echo "🔍 Cleaning up revisions for: $service_name"
    
    # Get all revisions sorted by creation time (oldest first)
    revisions=$(gcloud run revisions list --service=$service_name --region=us-central1 --format="value(metadata.name)" --sort-by="metadata.creationTimestamp")
    
    # Convert to array
    revision_array=($revisions)
    total_revisions=${#revision_array[@]}
    
    if [ $total_revisions -le 3 ]; then
        echo "  ✅ Only $total_revisions revisions found, no cleanup needed"
        return
    fi
    
    # Calculate how many to delete (keep latest 3)
    revisions_to_delete=$((total_revisions - 3))
    echo "  📊 Found $total_revisions revisions, deleting oldest $revisions_to_delete"
    
    # Delete oldest revisions
    for (( i=0; i<$revisions_to_delete; i++ )); do
        revision_name=${revision_array[$i]}
        echo "  🗑️  Deleting: $revision_name"
        gcloud run revisions delete $revision_name --region=us-central1 --quiet
        if [ $? -eq 0 ]; then
            echo "    ✅ Deleted successfully"
        else
            echo "    ❌ Failed to delete"
        fi
    done
    
    echo "  🎉 Cleanup complete for $service_name"
    echo ""
}

# Services with known high revision counts
echo "🎯 Targeting services with high revision counts..."

# Clean up the worst offenders first
cleanup_service_revisions "cleanvoicetranscript"
cleanup_service_revisions "processvoicewithemotion" 
cleanup_service_revisions "loadmanifest"
cleanup_service_revisions "savecoachreplyhttp"
cleanup_service_revisions "sendpractitionerinvitation"
cleanup_service_revisions "markcoachrepliesasread"
cleanup_service_revisions "monthlyinsightsscheduler"
cleanup_service_revisions "trackwishbehavior"
cleanup_service_revisions "triggermonthlyinsightstest"

echo "🎉 Revision cleanup complete!"
echo "💡 You can now try redeploying the failed functions."