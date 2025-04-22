    // After displaying all tools, show a summary of check times if status was checked
    if (options.status && totalCheckTime > 0) {
      const averageTime = totalCheckTime / toolNames.length;
      console.log(`\nStatus check timing summary:`);
      console.log(`- Total check time: ${totalCheckTime.toFixed(2)}ms`);
      console.log(`- Average check time: ${averageTime.toFixed(2)}ms per tool`);
    }

    // We only show the timing summary at the end to avoid duplication
 