// Show total check time only once
if (!timingSummaryDisplayed) {
  const totalCheckTime = calculateTotalCheckDuration(options.statusResults);
  console.log(`\nTotal status check time: ${(totalCheckTime / 1000).toFixed(2)}s (sum of all individual checks)`);
  
  // If we have a wall clock duration, show that too
  if (options.wallClockDuration) {
    console.log(`Actual execution time: ${(options.wallClockDuration / 1000).toFixed(2)}s (wall clock)`);
  }
  
  timingSummaryDisplayed = true;
} 
